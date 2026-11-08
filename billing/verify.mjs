// Firebase ID token verification for the billing rail.
// Pure node:crypto + fetch against Google's published JWKS — no admin SDK.
import crypto from 'node:crypto';

export class BillingConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BillingConfigError';
    this.status = 503;
    this.code = 'billing_not_configured';
  }
}

export class BillingAuthError extends Error {
  constructor(message = 'unauthorized') {
    super(message);
    this.name = 'BillingAuthError';
    this.status = 401;
    this.code = 'unauthorized';
  }
}

const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwks/securetoken@system.gserviceaccount.com';
const JWKS_TTL_MS = 60 * 60 * 1000;

let serviceAccountCache = null;

export function serviceAccount() {
  if (serviceAccountCache) return serviceAccountCache;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new BillingConfigError('FIREBASE_SERVICE_ACCOUNT_JSON is not set');
  try {
    serviceAccountCache = JSON.parse(raw);
  } catch {
    throw new BillingConfigError('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
  const sa = serviceAccountCache;
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new BillingConfigError(
      'FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id/client_email/private_key'
    );
  }
  return sa;
}

export function firebaseProjectId() {
  return serviceAccount().project_id;
}

function b64urlToBuffer(value) {
  return Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// Minimal DER encoder: RSA public key JWK (n, e) → SPKI PEM.
function derLength(length) {
  if (length < 0x80) return Buffer.from([length]);
  const bytes = [];
  for (let n = length; n > 0; n = Math.floor(n / 256)) bytes.unshift(n & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derInteger(buf) {
  if (buf.length === 0 || buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0x00]), buf]);
  return Buffer.concat([Buffer.from([0x02]), derLength(buf.length), buf]);
}

function derSequence(...parts) {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([0x30]), derLength(body.length), body]);
}

function derBitString(buf) {
  const body = Buffer.concat([Buffer.from([0x00]), buf]);
  return Buffer.concat([Buffer.from([0x03]), derLength(body.length), body]);
}

function jwkToPem(jwk) {
  const rsaPublicKey = derSequence(
    derInteger(b64urlToBuffer(jwk.n)),
    derInteger(b64urlToBuffer(jwk.e))
  );
  const algorithm = Buffer.concat([
    // OID 1.2.840.113549.1.1.1 (rsaEncryption) + NULL params
    Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]),
    Buffer.from([0x05, 0x00]),
  ]);
  const spki = derSequence(derSequence(algorithm), derBitString(rsaPublicKey));
  const b64 = spki.toString('base64').replace(/(.{64})/g, '$1\n');
  return `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----\n`;
}

let jwksCache = { keys: null, fetchedAt: 0 };

async function fetchJwks(force = false) {
  if (!force && jwksCache.keys && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(JWKS_URL);
  if (!res.ok) {
    throw Object.assign(new Error(`JWKS fetch failed (${res.status})`), { status: 502 });
  }
  const data = await res.json();
  jwksCache = { keys: Array.isArray(data.keys) ? data.keys : [], fetchedAt: Date.now() };
  return jwksCache.keys;
}

function findKey(keys, kid) {
  return keys.find((k) => k.kid === kid && k.kty === 'RSA' && k.n && k.e) || null;
}

// verifyIdToken(req) → { uid }
// req: standard Request (Web fetch API) with an `Authorization: Bearer <idToken>` header.
export async function verifyIdToken(req) {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw new BillingAuthError();
  const token = match[1];
  const parts = token.split('.');
  if (parts.length !== 3) throw new BillingAuthError('malformed token');

  let joseHeader;
  let payload;
  try {
    joseHeader = JSON.parse(b64urlToBuffer(parts[0]).toString('utf8'));
    payload = JSON.parse(b64urlToBuffer(parts[1]).toString('utf8'));
  } catch {
    throw new BillingAuthError('malformed token');
  }
  if (joseHeader.alg !== 'RS256' || typeof joseHeader.kid !== 'string') {
    throw new BillingAuthError('unsupported token algorithm');
  }

  const projectId = firebaseProjectId(); // throws BillingConfigError → truthful 503

  let jwk = findKey(await fetchJwks(), joseHeader.kid);
  if (!jwk) jwk = findKey(await fetchJwks(true), joseHeader.kid); // key rotation: refetch once
  if (!jwk) throw new BillingAuthError('unknown signing key');

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  if (!verifier.verify(jwkToPem(jwk), b64urlToBuffer(parts[2]))) {
    throw new BillingAuthError('bad signature');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new BillingAuthError('bad issuer');
  }
  if (payload.aud !== projectId) throw new BillingAuthError('bad audience');
  if (typeof payload.exp !== 'number' || payload.exp <= now) {
    throw new BillingAuthError('token expired');
  }
  if (typeof payload.iat !== 'number' || payload.iat > now + 300) {
    throw new BillingAuthError('bad issued-at');
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new BillingAuthError('no subject');
  }
  return { uid: payload.sub };
}
