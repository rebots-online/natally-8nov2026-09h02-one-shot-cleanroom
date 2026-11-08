import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';

const root = process.cwd();
const document = file => existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
const example = document(join(root, '.env.example'));
const env = { ...document(join(root, '.env')), ...process.env };
const admin = env.NATALLY_ADMIN_MANUAL || join(homedir(), 'Admin-Manual');
const signing = ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEY_ALIAS', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_PASSWORD', 'ANDROID_SIGNING_CERT_SHA256'];
const cache = new Map();
const driver = `import json,sys\nsys.path.insert(0,sys.argv[1])\nfrom kstore_client import KStoreClient\nr=KStoreClient().read_document(sys.stdin.read(),source_type='admin-manual')\nassert r.get('exact') is True\nprint(json.dumps(r))\n`;
function credential(path, fragment) {
  if (!cache.has(path)) {
    const moduleDir = env.KSTORE_CLIENT_MODULE_DIR || join(homedir(), '.local/share/kstore-client/current');
    const venv = join(moduleDir, '../venv/bin/python');
    const result = spawnSync(existsSync(venv) ? venv : 'python3', ['-c', driver, moduleDir], { input: path, encoding: 'utf8', timeout: 120000 });
    let content;
    if (result.status === 0) {
      try { content = JSON.parse(result.stdout).content; } catch { /* Exact local canonical below. */ }
    }
    if (typeof content !== 'string') {
      const local = resolve(admin, path);
      if (!local.startsWith(resolve(admin) + '/')) throw Error('Credential path escapes Admin-Manual');
      if (!existsSync(local)) throw Error(`Credential document unavailable: ${path}`);
      content = readFileSync(local, 'utf8');
      console.error(`Using Admin-Manual checkout fallback for ${path}; KStore retrieval needs repair.`);
    }
    cache.set(path, parseEnv(content));
  }
  const value = cache.get(path)[fragment];
  if (!value || value.startsWith('kstore:')) throw Error(`Credential fragment unavailable: ${path}#${fragment}`);
  return value;
}
function resolveValue(name, value) {
  if (!value?.startsWith('kstore://')) return value;
  const match = /^kstore:\/\/admin-manual\/([^#]+)#([^#]+)$/.exec(value);
  if (!match) throw Error(`Invalid credential pointer: ${name}`);
  return credential(match[1], match[2]);
}
for (const name of signing) {
  env[name] = resolveValue(name, env[name] || example[name]);
  if (!env[name]) throw Error(`Required native signing setting missing: ${name}`);
}
for (const [name, value] of Object.entries(env)) {
  if (name.startsWith('VITE_') && value?.startsWith('kstore://')) env[name] = resolveValue(name, value);
}
if (!isAbsolute(env.ANDROID_KEYSTORE_PATH)) env.ANDROID_KEYSTORE_PATH = resolve(admin, env.ANDROID_KEYSTORE_PATH);
if (!existsSync(env.ANDROID_KEYSTORE_PATH)) throw Error('Configured Android keystore file is unavailable');
env.NATALLY_BUILD_ENV_RESOLVED = '1';
const [command, ...args] = process.argv.slice(2);
if (!command) throw Error('A canonical build command is required');
const child = spawnSync(command, args, { env, stdio: 'inherit' });
if (child.error) throw Error(`Canonical build could not start: ${child.error.code}`);
process.exitCode = child.status ?? 1;
