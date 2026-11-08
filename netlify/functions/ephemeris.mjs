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
// X-Response is a base64 ECDSA-P256/SHA256 signature over the nonce,
// verified with node:crypto.verify against the challenge pubkey. The signed
// input is accepted in BOTH canonical forms: the exact X-Nonce STRING bytes
// (utf-8) and, when the nonce is the 64-char hex value issued by /challenge,
// its HEX-DECODED 32 bytes (Buffer.from(nonce,'hex') — the deployed client's
// form). Signature encodings accepted: DER (Node crypto.sign) and
// ieee-p1363 (WebCrypto subtle.sign). Nonce freshness is NOT enforced — the
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
// Engine lifecycle: swisseph-wasm is loaded LAZILY and only positions/houses
// ever touch it (health/challenge are pure node:crypto and must never fail on
// engine trouble). Init runs at most once per invocation, memoized across warm
// invocations; a failed init is forgotten so the next invocation can retry.
// The wrapper's default wasm/data resolution breaks under esbuild bundling,
// so the Emscripten glue is driven directly with assets from the installed
// package when resolvable on disk, else fetched (version-pinned) from jsDelivr
// into a writable tmp dir — see the engine block below. Every engine failure
// maps to 500; bundled ephemeris data covers ≈1800–2400 AD.

import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

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

// --- wasm engine: loaded lazily, at most one init per invocation ---
// Bundler-proof loading: the swisseph-wasm wrapper class resolves its wasm and
// ephemeris-data files relative to import.meta.url, which breaks when the
// function is esbuild-bundled (assets are not next to the bundle). We bypass
// the wrapper's init and drive the Emscripten glue factory directly:
//   1. installed package resolvable on disk (unbundled deploy): import its
//      glue by file URL and use its own wasm/data files;
//   2. otherwise (bundled deploy, no node_modules): fetch the version-pinned
//      glue/wasm/data trio from jsDelivr into a writable tmp dir and run the
//      glue from there (it needs a real file URL for createRequire).
const SWE_VERSION = '0.1.0'; // must match the swisseph-wasm dependency in package.json
const SWE_CDN_BASE = `https://cdn.jsdelivr.net/npm/swisseph-wasm@${SWE_VERSION}/wasm/`;
const SWE_ASSET_FILES = ['swisseph.js', 'swisseph.wasm', 'swisseph.data'];

// Swiss Ephemeris ABI constants (stable public ids; swisseph-wasm 0.1.0 exposes
// the same values as SE_* instance properties — pinned numerically because the
// wrapper class instance is not constructed here).
const SEFLG_SWIEPH = 2;
const SEFLG_SPEED = 256;
const SE_BODY_ID = {
  Sun: 0, Moon: 1, Mercury: 2, Venus: 3, Mars: 4, Jupiter: 5, Saturn: 6,
  Uranus: 7, Neptune: 8, Pluto: 9, trueNode: 11, Chiron: 15,
};

let enginePromise = null;
function getEngine() {
  if (!enginePromise) {
    enginePromise = initEngine().catch((err) => { enginePromise = null; throw err; }); // failed init → retry next invocation
  }
  return enginePromise;
}

async function stageCdnAssets(dir) {
  await mkdir(dir, { recursive: true });
  await Promise.all(SWE_ASSET_FILES.map(async (name) => {
    const finalPath = join(dir, name);
    if (existsSync(finalPath)) return;
    const res = await fetch(SWE_CDN_BASE + name, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`fetching ${name} from CDN: HTTP ${res.status}`);
    const tmpPath = join(dir, `${name}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`);
    await writeFile(tmpPath, Buffer.from(await res.arrayBuffer()));
    await rename(tmpPath, finalPath); // atomic within the dir; a concurrent instance overwrites harmlessly
  }));
  return dir;
}

async function initEngine() {
  const require = createRequire(import.meta.url);
  let glueUrl = null;
  let assetDir = null;
  try {
    const pkgWasmDir = join(dirname(require.resolve('swisseph-wasm/package.json')), 'wasm');
    if (SWE_ASSET_FILES.every((name) => existsSync(join(pkgWasmDir, name)))) {
      glueUrl = pathToFileURL(join(pkgWasmDir, 'swisseph.js')).href;
      assetDir = pkgWasmDir;
    }
  } catch { /* package not on disk (bundled deploy) → CDN fallback below */ }
  if (!glueUrl) {
    assetDir = await stageCdnAssets(join(tmpdir(), `natally-swisseph-${SWE_VERSION}`));
    glueUrl = pathToFileURL(join(assetDir, 'swisseph.js')).href;
  }
  const factory = (await import(glueUrl)).default;
  const module = await factory({ locateFile: (name) => join(assetDir, name) });
  if (!module.HEAP32) module.HEAP32 = new Int32Array(module.HEAPF64.buffer);
  module.ccall('swe_set_ephe_path', 'string', ['string'], ['sweph']); // data package mounts ephemeris files at /sweph
  return {
    calcUt: (julianDay, bodyId, flags) => sweCalcUt(module, julianDay, bodyId, flags),
    houses: (julianDay, geoLat, geoLon, hsys) => sweHouses(module, julianDay, geoLat, geoLon, hsys),
  };
}

// Thin C bridge over the Emscripten module, mirroring swisseph-wasm's own
// calc_ut/houses methods (identical ccall signatures and buffer handling).
function sweCalcUt(module, julianDay, bodyId, flags) {
  const xxPtr = module._malloc(6 * 8);
  const serrPtr = module._malloc(256);
  try {
    const retFlag = module.ccall(
      'swe_calc_ut', 'number',
      ['number', 'number', 'number', 'pointer', 'pointer'],
      [julianDay, bodyId, flags, xxPtr, serrPtr],
    );
    if (retFlag < 0) throw new Error(`swe_calc_ut: ${module.UTF8ToString(serrPtr)}`);
    return module.HEAPF64.slice(xxPtr / 8, xxPtr / 8 + 6); // [lon, lat, dist, lonSpeed, latSpeed, distSpeed]
  } finally {
    module._free(xxPtr);
    module._free(serrPtr);
  }
}

function sweHouses(module, julianDay, geoLat, geoLon, hsys) {
  const cuspsPtr = module._malloc(13 * 8);
  const ascmcPtr = module._malloc(10 * 8);
  try {
    module.ccall(
      'swe_houses', 'number',
      ['number', 'number', 'number', 'number', 'pointer', 'pointer'],
      [julianDay, geoLat, geoLon, hsys.charCodeAt(0), cuspsPtr, ascmcPtr],
    );
    return {
      cusps: new Float64Array(module.HEAPF64.buffer, cuspsPtr, 13).slice(), // index 0 unused
      ascmc: new Float64Array(module.HEAPF64.buffer, ascmcPtr, 10).slice(), // [0]=Asc, [1]=MC
    };
  } finally {
    module._free(cuspsPtr);
    module._free(ascmcPtr);
  }
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

async function loadKeyState() {
  const raw = (process.env.EPHEMERIS_SIGNING_KEY || '').trim();
  if (raw) {
    let publicKey;
    try {
      publicKey = crypto.createPublicKey(parsePrivateKey(raw));
    } catch {
      throw new HttpError(500, 'invalid EPHEMERIS_SIGNING_KEY');
    }
    if (publicKey.export({ format: 'jwk' }).crv !== 'P-256') {
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
  const sig = Buffer.from(signatureB64, 'base64');
  if (sig.length === 0) return false;
  // Signed-input forms: the raw nonce string (utf-8) and, for hex nonces
  // (e.g. the 64-char value from /challenge), the decoded bytes.
  const inputs = [Buffer.from(nonce, 'utf8')];
  if (nonce.length >= 2 && nonce.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(nonce)) {
    inputs.push(Buffer.from(nonce, 'hex'));
  }
  // DER: Node crypto.sign default. ieee-p1363: WebCrypto/browser ECDSA.
  for (const data of inputs) {
    for (const dsaEncoding of ['der', 'ieee-p1363']) {
      try {
        if (crypto.verify('sha256', data, { key: publicKey, dsaEncoding }, sig)) return true;
      } catch { /* signature not valid for this input/encoding */ }
    }
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
  const engine = await getEngine();
  const flags = SEFLG_SWIEPH | SEFLG_SPEED;
  const positions = bodies.map((key) => {
    const xx = engine.calcUt(julianDay, SE_BODY_ID[key], flags);
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
  const engine = await getEngine();
  const { cusps, ascmc } = engine.houses(julianDay, latitude, longitude, system);
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
