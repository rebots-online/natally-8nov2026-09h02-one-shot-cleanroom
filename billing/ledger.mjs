// Runtime billing ledger over the Firebase Admin REST APIs — no admin SDK.
// Service-account JWT → OAuth access token → Firestore REST v1.
import crypto from 'node:crypto';
import { BillingConfigError, serviceAccount } from './verify.mjs';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const FIRESTORE_BASE = () =>
  `https://firestore.googleapis.com/v1/projects/${serviceAccount().project_id}/databases/(default)/documents`;

let tokenCache = { token: null, expiresAt: 0 };

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getAccessToken() {
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt > now + 60_000) return tokenCache.token;
  const sa = serviceAccount();
  const iat = Math.floor(now / 1000);
  const input = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: TOKEN_URL,
      iat,
      exp: iat + 3600,
      scope: SCOPE,
    })
  )}`;
  const signature = crypto.createSign('RSA-SHA256').update(input).sign(sa.private_key);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${input}.${b64url(signature)}`,
    }),
  });
  if (!res.ok) {
    throw Object.assign(new Error(`oauth token fetch failed (${res.status})`), { status: 502 });
  }
  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: now + (Number(data.expires_in) || 3600) * 1000,
  };
  return tokenCache.token;
}

async function fsRequest(url, init = {}) {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = (body.error && body.error.status) || res.status;
    } catch {
      detail = res.status;
    }
    const err = new Error(`firestore ${res.status}: ${detail}`);
    if (res.status === 404 || res.status === 409) err.status = res.status;
    else err.status = 502;
    err.upstreamStatus = res.status;
    throw err;
  }
  return res.json();
}

const JSON_HEADERS = { 'content-type': 'application/json' };

function fsFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (typeof value === 'number' && Number.isInteger(value)) fields[key] = { integerValue: String(value) };
    else if (typeof value === 'boolean') fields[key] = { booleanValue: value };
    else if (value instanceof Date) fields[key] = { timestampValue: value.toISOString() };
    else if (value === null) fields[key] = { nullValue: null };
    else fields[key] = { stringValue: String(value) };
  }
  return { fields };
}

function fromFsValue(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.mapValue !== undefined) return mapFromFs(value.mapValue.fields);
  if (value.arrayValue !== undefined)
    return (value.arrayValue.values || []).map(fromFsValue);
  return value.stringValue;
}

function mapFromFs(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromFsValue(v)]));
}

const docUrl = (path) => `${FIRESTORE_BASE()}/${path}`;

// ── Grants (idempotent credits) ─────────────────────────────────────────────

function sha256Id(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export function webhookGrantId(eventId) {
  return sha256Id(`chargebee:${eventId}`);
}

// recordGrant → { created, id }
// Create-if-not-exists: the doc id derives from the event, so replays of the
// same event are absorbed (Firestore POST + documentId → 409 ALREADY_EXISTS).
export async function recordGrant({ uid, source, eventId, usdMicros, meta }) {
  if (!Number.isInteger(usdMicros) || usdMicros <= 0) {
    throw Object.assign(new Error('invalid grant usdMicros'), { status: 400 });
  }
  const id =
    source === 'chargebee'
      ? webhookGrantId(eventId)
      : sha256Id(`${source}:${uid}:${eventId}`);
  const body = fsFields({
    uid,
    source,
    eventId,
    usdMicros,
    meta: meta ? JSON.stringify(meta) : '',
    at: new Date(),
  });
  try {
    await fsRequest(`${docUrl('natallyCreditGrants')}?documentId=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    return { created: true, id };
  } catch (err) {
    if (err.status === 409) return { created: false, id };
    throw err;
  }
}

// ── Usage (appends) ─────────────────────────────────────────────────────────

// Usage appends land in the natallyUsage/<uid>/events subcollection.
export async function recordUsage({ uid, usdMicros, model, requestId }) {
  if (!Number.isInteger(usdMicros) || usdMicros < 0) {
    throw Object.assign(new Error('invalid usage usdMicros'), { status: 400 });
  }
  const body = fsFields({ uid, usdMicros, model: model || '', requestId: requestId || '', at: new Date() });
  const data = await fsRequest(docUrl(`natallyUsage/${encodeURIComponent(uid)}/events`), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
  return { id: String(data.name || '').split('/').pop() };
}

// ── Queries ─────────────────────────────────────────────────────────────────

async function runQuery(collectionId, uid, { allDescendants = false, select } = {}) {
  const structuredQuery = {
    from: [{ collectionId, ...(allDescendants ? { allDescendants: true } : {}) }],
    where: {
      fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: uid } },
    },
  };
  if (select) structuredQuery.select = { fields: [{ fieldPath: select }] };
  const rows = await fsRequest(`${FIRESTORE_BASE()}:runQuery`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ structuredQuery }),
  });
  return rows.filter((row) => row.document);
}

export async function allowance(uid) {
  const [grantRows, usageRows] = await Promise.all([
    runQuery('natallyCreditGrants', uid, { select: 'usdMicros' }),
    runQuery('events', uid, { allDescendants: true, select: 'usdMicros' }),
  ]);
  const sum = (rows) =>
    rows.reduce((total, row) => total + Number(row.document.fields.usdMicros?.integerValue || 0), 0);
  const grantsUsdMicros = sum(grantRows);
  const postedUsageUsdMicros = sum(usageRows);
  return {
    allowanceUsdMicros: grantsUsdMicros - postedUsageUsdMicros,
    grantsUsdMicros,
    postedUsageUsdMicros,
  };
}

function docToRecord(doc) {
  const fields = mapFromFs(doc.fields);
  return { id: String(doc.name || '').split('/').pop(), ...fields };
}

export async function history(uid) {
  const [grantRows, usageRows] = await Promise.all([
    runQuery('natallyCreditGrants', uid),
    runQuery('events', uid, { allDescendants: true }),
  ]);
  const byAtDesc = (a, b) => String(b.at || '').localeCompare(String(a.at || ''));
  return {
    grants: grantRows.map((row) => docToRecord(row.document)).sort(byAtDesc),
    usage: usageRows.map((row) => docToRecord(row.document)).sort(byAtDesc),
  };
}

// ── Managed OpenRouter keys (encrypted at rest) ─────────────────────────────

function encryptionKey() {
  const raw = process.env.BILLING_KEY_ENCRYPTION_KEY;
  if (!raw) throw new BillingConfigError('BILLING_KEY_ENCRYPTION_KEY is not set');
  const asBase64 = Buffer.from(raw, 'base64');
  if (asBase64.length === 32 && /^[A-Za-z0-9+/]+={0,2}$/.test(raw)) return asBase64;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  const asUtf8 = Buffer.from(raw, 'utf8');
  if (asUtf8.length === 32) return asUtf8;
  throw new BillingConfigError('BILLING_KEY_ENCRYPTION_KEY must decode to 32 bytes (base64 or hex)');
}

// AES-256-GCM, AAD = uid + generation.
function encryptForUid(uid, generation, plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`${uid}|${generation}`, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

function decryptForUid(uid, generation, { ciphertext, iv, tag }) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAAD(Buffer.from(`${uid}|${generation}`, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export async function getManagedKey(uid) {
  try {
    const doc = await fsRequest(docUrl(`natallyManagedKeys/${encodeURIComponent(uid)}`));
    const fields = mapFromFs(doc.fields);
    const key = decryptForUid(uid, fields.generation, fields);
    return {
      key,
      generation: fields.generation,
      limitUsdMicros: fields.limitUsdMicros,
      openrouterKeyId: fields.openrouterKeyId || '',
    };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function saveManagedKey(uid, { openrouterKey, openrouterKeyId, limitUsdMicros }) {
  const existing = await getManagedKey(uid);
  const generation = (existing?.generation || 0) + 1;
  const body = fsFields({
    ...encryptForUid(uid, generation, openrouterKey),
    generation,
    limitUsdMicros,
    openrouterKeyId: openrouterKeyId || existing?.openrouterKeyId || '',
  });
  await fsRequest(docUrl(`natallyManagedKeys/${encodeURIComponent(uid)}`), {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
  return { generation };
}

export async function setManagedKeyLimit(uid, limitUsdMicros) {
  const body = fsFields({ limitUsdMicros });
  await fsRequest(
    `${docUrl(`natallyManagedKeys/${encodeURIComponent(uid)}`)}?updateMask.fieldPaths=limitUsdMicros`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(body) }
  );
}
