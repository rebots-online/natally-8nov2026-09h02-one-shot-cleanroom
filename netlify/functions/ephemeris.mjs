// netlify/functions/ephemeris.mjs — Natally ephemeris API (Netlify Function v2).
//
// Swiss Ephemeris (swisseph-wasm, wasm build, bundled data ≈1800–2400 AD; dates
// outside that window surface as {error:'ephemeris engine failure'}).
//
// Routes (mounted at /ephemeris/* via `config.path`; also reachable as
// /.netlify/functions/ephemeris/<route> — the last path segment is the route):
//   GET  /ephemeris/health     → {service:'natally-ephemeris', status:'ok'}
//   GET  /ephemeris/challenge  → {nonce, pubkey, ephemeral}
//   POST /ephemeris/positions  → {julianDay, positions:[{key,longitude,latitude,distance,speedLongitude}]}
//   POST /ephemeris/houses     → {julianDay, cusps[12], ascmc[10]}
//
// Auth (positions + houses only): headers `X-Nonce` + `X-Response`, where
// X-Response is a base64 ECDSA-P256/SHA256 signature over the exact X-Nonce
// bytes, verified with node:crypto.verify against the challenge pubkey.
// Both DER (Node crypto.sign) and ieee-p1363 (WebCrypto subtle.sign)
// signature encodings are accepted. Nonce freshness is NOT enforced — the
// function is stateless (no challenge store), so any correctly-signed nonce
// value verifies until the key rotates.
//
// Keypair: env EPHEMERIS_SIGNING_KEY must hold a P-256 private key, either PEM
// ("-----BEGIN ...") or base64 DER (PKCS#8, falling back to SEC1). If absent,
// an ephemeral in-memory keypair is generated once per function instance and
// /challenge reports {ephemeral:true}. LIMITATION (known and documented, not
// hidden): in ephemeral mode only the instance itself holds the private half,
// so no external client can satisfy auth — suitable for smoke-testing only.
// An invalid/unreadable EPHEMERIS_SIGNING_KEY fails closed with 500 rather
// than silently downgrading to ephemeral.
//
// One-strike ban (operator rule): ANY failed verification on a protected
// route (missing headers or a non-verifying signature) adds the client IP
// (x-nf-client-connection-ip, falling back to x-forwarded-for) to a
// module-level Set and every /ephemeris/* route then rejects that IP with 403
// for the LIFETIME OF THIS INSTANCE ONLY. Netlify recycles instances, so this
// is per-instance containment, NOT a durable blocklist. A persistent
// Firestore-backed ban list is a stated follow-up and is deliberately NOT
// faked here.
//
// Validation & errors: 400 {error} (unparseable utcIso, |latitude|>90,
// |longitude|>180, house system outside PKRCEA, unknown body, bad JSON);
// 401 {error} auth failure; 403 {error} banned IP; 404 unknown route;
// 405 wrong method; 500 {error:'ephemeris engine failure'} on wasm init or
// calculation failure. CORS: any origin, GET/POST (+OPTIONS preflight).
//
// Engine lifecycle: the wasm engine is initialized lazily AT MOST ONCE per
// invocation (init promise memoized across warm invocations of the same
// instance; a failed init is forgotten so the next invocation can retry) and
// every use is wrapped so failures map to 500, never crash the instance.

import crypto from 'node:crypto';
import SwissEph from 'swisseph-wasm';

export const config = { path: '/ephemeris/*' };

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type, X-Nonce, X-Response',
};

const HOUSE_SYSTEMS = 'PKRCEA';
const DEFAULT_BODIES = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
  'Uranus', 'Neptune', 'Pluto', 'trueNode', 'Chiron',
];
const CANONICAL_BODY = new Map([
  ['sun', 'Sun'], ['moon', 'Moon'], ['mercury', 'Mercury'], ['venus', 'Venus'],
  ['mars', 'Mars'], ['jupiter', 'Jupiter'], ['saturn', 'Saturn'],
  ['uranus', 'Uranus'], ['neptune', 'Neptune'], ['pluto', 'Pluto'],
  ['truenode', 'trueNode'], ['chiron', 'Chiron'],
]);

// One-strike ban: per-instance only (see header comment).
const bannedIps = new Set();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// --- wasm engine: init at most once per invocation, memoize across warm calls ---
let enginePromise = null;
function getEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const swe = new SwissEph();
      await swe.initSwissEph();
      return swe;
    })();
    enginePromise.catch(() => { enginePromise = null; }); // forget failed init → retry next invocation
  }
  return enginePromise;
}

// --- signing keypair: env P-256 key, else ephemeral per instance ---
let keyStatePromise = null;
function getKeyState() {
  if (!keyStatePromise) {
    keyStatePromise = loadKeyState().catch((err) => { keyStatePromise = null; throw err; });
  }
  return keyStatePromise;
}

function parsePrivateKey(raw) {
  if (raw.includes('-----BEGIN')) return crypto.createPrivateKey(raw);
  const der = Buffer.from(raw, 'base64');
  try {
    return crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  } catch {
    return crypto.createPrivateKey({ key: der, format: 'der', type: 'sec1' });
  }
}

function loadKeyState() {
  const raw = (process.env.EPHEMERIS_SIGNING_KEY || '').trim();
  if (raw) {
    let publicKey;
    try {
      publicKey = crypto.createPublicKey(parsePrivateKey(raw));
    } catch {
      throw new HttpError(500, 'invalid EPHEMERIS_SIGNING_KEY');
    }
    if (publicKey.asymmetricDetails?.namedCurve !== 'prime256v1') {
      throw new HttpError(500, 'invalid EPHEMERIS_SIGNING_KEY');
    }
    return {
      publicKey,
      spkiB64: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
      ephemeral: false,
    };
  }
  const { publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return {
    publicKey,
    spkiB64: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    ephemeral: true,
  };
}

function verifySignature(publicKey, nonce, signatureB64) {
  const data = Buffer.from(nonce, 'utf8');
  const sig = Buffer.from(signatureB64, 'base64');
  if (sig.length === 0) return false;
  // DER: Node crypto.sign default. ieee-p1363: WebCrypto/browser ECDSA.
  for (const dsaEncoding of ['der', 'ieee-p1363']) {
    try {
      if (crypto.verify('sha256', data, { key: publicKey, dsaEncoding }, sig)) return true;
    } catch { /* signature not valid for this encoding */ }
  }
  return false;
}

async function requireAuth(request, ip) {
  const nonce = request.headers.get('x-nonce');
  const responseSig = request.headers.get('x-response');
  if (nonce && responseSig) {
    const { publicKey } = await getKeyState(); // 500 if env key invalid; no ban (server fault)
    if (verifySignature(publicKey, nonce, responseSig)) return;
  }
  if (ip) bannedIps.add(ip); // one-strike: any failed verification bans for this instance
  throw new HttpError(401, 'unauthorized');
}

// --- request helpers ---
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

function clientIp(request) {
  const direct = request.headers.get('x-nf-client-connection-ip');
  if (direct) return direct.trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return null;
}

function routeOf(url) {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

async function readJsonObject(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    throw new HttpError(400, 'request body must be valid JSON');
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new HttpError(400, 'request body must be a JSON object');
  }
  return payload;
}

function resolveJulianDay(payload) {
  if (payload.utcIso !== undefined && payload.utcIso !== null) { // utcIso wins if both are sent
    if (typeof payload.utcIso !== 'string') throw new HttpError(400, 'utcIso must be a string');
    const ms = Date.parse(payload.utcIso);
    if (Number.isNaN(ms)) throw new HttpError(400, 'utcIso is not a parseable date');
    return ms / 86400000 + 2440587.5;
  }
  if (payload.julianDay !== undefined && payload.julianDay !== null) {
    if (typeof payload.julianDay !== 'number' || !Number.isFinite(payload.julianDay)) {
      throw new HttpError(400, 'julianDay must be a finite number');
    }
    return payload.julianDay;
  }
  throw new HttpError(400, 'utcIso or julianDay is required');
}

function resolveBodies(bodies) {
  if (bodies === undefined || bodies === null) return DEFAULT_BODIES.slice();
  if (!Array.isArray(bodies)) throw new HttpError(400, 'bodies must be an array of strings');
  return bodies.map((b) => {
    if (typeof b !== 'string') throw new HttpError(400, 'bodies must be an array of strings');
    const canonical = CANONICAL_BODY.get(b.toLowerCase().replace(/[\s_-]+/g, ''));
    if (!canonical) throw new HttpError(400, `unknown body "${b}" (allowed: ${DEFAULT_BODIES.join(', ')})`);
    return canonical;
  });
}

function finiteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new HttpError(400, `${name} must be a finite number`);
  }
  return value;
}

function bodyIds(swe) {
  return {
    Sun: swe.SE_SUN,
    Moon: swe.SE_MOON,
    Mercury: swe.SE_MERCURY,
    Venus: swe.SE_VENUS,
    Mars: swe.SE_MARS,
    Jupiter: swe.SE_JUPITER,
    Saturn: swe.SE_SATURN,
    Uranus: swe.SE_URANUS,
    Neptune: swe.SE_NEPTUNE,
    Pluto: swe.SE_PLUTO,
    trueNode: swe.SE_TRUE_NODE,
    Chiron: swe.SE_CHIRON,
  };
}

// --- route handlers ---
async function handleChallenge(request) {
  if (request.method !== 'GET') throw new HttpError(405, 'method not allowed');
  const { spkiB64, ephemeral } = await getKeyState();
  return json(200, { nonce: crypto.randomBytes(32).toString('hex'), pubkey: spkiB64, ephemeral });
}

async function handlePositions(request, ip) {
  if (request.method !== 'POST') throw new HttpError(405, 'method not allowed');
  await requireAuth(request, ip);
  const payload = await readJsonObject(request);
  const julianDay = resolveJulianDay(payload);
  const bodies = resolveBodies(payload.bodies);
  const swe = await getEngine();
  const ids = bodyIds(swe);
  const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;
  // calc_ut → Float64Array(6): [longitude, latitude, distance, lonSpeed, latSpeed, distSpeed]
  const positions = bodies.map((key) => {
    const xx = swe.calc_ut(julianDay, ids[key], flags);
    return { key, longitude: xx[0], latitude: xx[1], distance: xx[2], speedLongitude: xx[3] };
  });
  return json(200, { julianDay, positions });
}

async function handleHouses(request, ip) {
  if (request.method !== 'POST') throw new HttpError(405, 'method not allowed');
  await requireAuth(request, ip);
  const payload = await readJsonObject(request);
  const julianDay = resolveJulianDay(payload);
  const latitude = finiteNumber(payload.latitude, 'latitude');
  const longitude = finiteNumber(payload.longitude, 'longitude');
  if (Math.abs(latitude) > 90) throw new HttpError(400, 'latitude must be within ±90 degrees');
  if (Math.abs(longitude) > 180) throw new HttpError(400, 'longitude must be within ±180 degrees');
  let system = payload.system === undefined || payload.system === null ? 'P' : payload.system;
  if (typeof system !== 'string' || system.length !== 1 || !HOUSE_SYSTEMS.includes(system.toUpperCase())) {
    throw new HttpError(400, 'system must be one of P, K, R, C, E, A');
  }
  system = system.toUpperCase();
  const swe = await getEngine();
  const { cusps, ascmc } = swe.houses(julianDay, latitude, longitude, system);
  return json(200, { julianDay, cusps: Array.from(cusps.slice(1, 13)), ascmc: Array.from(ascmc) });
}

export default async function handler(request) {
  const ip = clientIp(request);
  if (ip && bannedIps.has(ip)) return json(403, { error: 'forbidden' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  try {
    switch (routeOf(request.url)) {
      case 'health':
        if (request.method !== 'GET') throw new HttpError(405, 'method not allowed');
        return json(200, { service: 'natally-ephemeris', status: 'ok' });
      case 'challenge':
        return await handleChallenge(request);
      case 'positions':
        return await handlePositions(request, ip);
      case 'houses':
        return await handleHouses(request, ip);
      default:
        throw new HttpError(404, 'not found');
    }
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message });
    console.error('ephemeris engine failure:', err);
    return json(500, { error: 'ephemeris engine failure' });
  }
}
