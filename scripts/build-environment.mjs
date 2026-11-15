import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';

const root = process.cwd();
const document = file => existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
const example = document(join(root, '.env.example'));
const env = { ...Object.fromEntries(Object.entries(example).filter(([name]) => name.startsWith('VITE_') || name.startsWith('KSTORE_'))), ...document(join(root, '.env')), ...process.env };
const [command, ...args] = process.argv.slice(2);
if (!command) throw Error('A canonical build command is required');
const webOnly = args.includes('--web-only');
const admin = resolve(env.NATALLY_ADMIN_MANUAL || join(homedir(), 'Admin-Manual'));
const signing = ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEY_ALIAS', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_PASSWORD', 'ANDROID_SIGNING_CERT_SHA256'];
const cache = new Map();
async function credential(path, fragment) {
  if (!cache.has(path)) {
    let content;
    if (env.KSTORE_URL) {
      try {
        const url = new URL('doc', env.KSTORE_URL.replace(/\/?$/, '/'));
        url.searchParams.set('id', path); url.searchParams.set('source_type', 'admin-manual');
        const headers = env.KSTORE_HTTP_BEARER_TOKEN ? { Authorization: 'Bearer ' + env.KSTORE_HTTP_BEARER_TOKEN } : {};
        const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw Error('HTTP ' + response.status);
        const record = await response.json();
        if (record.exact !== true || typeof record.content !== 'string' || record.sha256 !== createHash('sha256').update(record.content).digest('hex')) throw Error('KStore exact document digest mismatch');
        content = record.content;
      } catch (error) { console.error(`KStore credential read failed: ${error.message}; using configured private credential checkout`); }
    }
    if (typeof content !== 'string') {
      const local = resolve(admin, path);
      if (!local.startsWith(admin + '/')) throw Error('Credential path escapes private authority');
      if (!existsSync(local)) throw Error(`Credential document unavailable: ${path}`);
      console.error(`Using private Admin-Manual credential document ${path}; no KStore write is performed`);
      content = readFileSync(local, 'utf8');
    }
    cache.set(path, parseEnv(content));
  }
  const value = cache.get(path)[fragment];
  if (!value || value.startsWith('kstore:')) throw Error(`Credential fragment unavailable: ${path}#${fragment}`);
  return value;
}
async function resolveValue(name, value) {
  if (!value?.startsWith('kstore://')) return value;
  const match = /^kstore:\/\/admin-manual\/([^#]+)(?:#([^#]+))?$/.exec(value);
  if (!match) throw Error(`Invalid credential pointer: ${name}`);
  return credential(match[1], match[2] || name);
}
for (const [name, value] of Object.entries(env)) if (name.startsWith('VITE_')) env[name] = await resolveValue(name, value);
let billing;
try { billing = new URL(env.VITE_BILLING_API_URL); }
catch { throw Error('Configure the actual approved HTTPS VITE_BILLING_API_URL; no endpoint is substituted'); }
if (billing.protocol !== 'https:' || billing.username || billing.password || /(^|\.)netlify\.(app|com)$/i.test(billing.hostname)) throw Error('Configure the actual approved HTTPS billing endpoint; retired Netlify endpoints cannot be published');
if (!env.VITE_CHARGEBEE_SITE?.trim() || env.VITE_CHARGEBEE_SITE.startsWith('kstore:')) throw Error('Existing VITE_CHARGEBEE_SITE must be configured');
if (!webOnly) {
  for (const name of signing) {
    env[name] = await resolveValue(name, env[name] || example[name]);
    if (!env[name]) throw Error(`Required native signing setting missing: ${name}`);
  }
  if (!isAbsolute(env.ANDROID_KEYSTORE_PATH)) env.ANDROID_KEYSTORE_PATH = resolve(admin, env.ANDROID_KEYSTORE_PATH);
  if (!existsSync(env.ANDROID_KEYSTORE_PATH)) throw Error('Configured production Android keystore is unavailable');
}
for (const [name,value] of Object.entries(env)) if (name.startsWith('VITE_') && value?.startsWith('kstore:')) throw Error(`Unresolved public pointer: ${name}`);
env.NATALLY_BUILD_ENV_RESOLVED = '1';
const child = spawnSync(command, args, { env, stdio: 'inherit' });
if (child.error) throw Error(`Canonical build could not start: ${child.error.code}`);
process.exitCode = child.status ?? 1;
