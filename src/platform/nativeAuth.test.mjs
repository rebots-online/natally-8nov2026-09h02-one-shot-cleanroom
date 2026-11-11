import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const storageKey = 'natally-native-auth-flow-v1';
const state = 'a'.repeat(64);
const flow = () => ({ port: 43021, state, provider: 'google', startedAt: Date.now() - 1000, redirecting: true });
const normalize = value => JSON.parse(JSON.stringify(value));
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };

async function execute(file, options = {}) {
  const calls = { invoke: [], installed: [], popup: 0, redirects: 0, redirectResults: 0, apps: [], persistence: [], forms: [], history: [] };
  const storage = new Map(options.stored ? [[storageKey, typeof options.stored === 'string' ? options.stored : JSON.stringify(options.stored)]] : []);
  const sessionStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  };
  class Element {
    constructor(tagName) { this.tagName = tagName; this.children = []; this.listeners = new Map(); this.disabled = true; this.textContent = ''; }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    append(element) { this.children.push(element); }
    click() { if (!this.disabled) this.listeners.get('click')?.(); }
    submit() { calls.forms.push(this); }
  }
  const elements = new Map(['native-auth-status', 'native-auth-continue', 'native-auth-cancel'].map(id => [id, new Element(id)]));
  const location = { origin: options.origin ?? 'https://asknatally.online', pathname: '/auth/native.html', search: '', hash: options.hash ?? '' };
  const window = { location, ...(options.native ? { __TAURI_INTERNALS__: {} } : {}) };
  const document = { getElementById: id => elements.get(id), createElement: tag => new Element(tag), body: new Element('body') };
  const auth = { currentUser: null };
  const app = { name: '[DEFAULT]' };
  class FirebaseError extends Error { constructor(code) { super(code); this.code = code; } }
  class GoogleAuthProvider {
    static credential(idToken, accessToken) { return { idToken, accessToken }; }
    static credentialFromResult(result) { return result.credential; }
  }
  const context = vm.createContext({ window, document, sessionStorage, URLSearchParams, Error,
    history: { replaceState: (_state, _unused, url) => { calls.history.push(url); location.hash = ''; } } });
  const exports = {
    'firebase/app': { FirebaseError, getApp: () => app, getApps: () => [], initializeApp: (_config, name) => { const value = { name: name ?? '[DEFAULT]' }; calls.apps.push(value); return value; } },
    'firebase/auth': {
      GoogleAuthProvider, getAuth: () => auth,
      getRedirectResult: async () => { calls.redirectResults++; return options.redirectResult ?? null; },
      onAuthStateChanged: () => () => {},
      signInWithCredential: async (owner, credential) => { calls.installed.push({ owner, credential }); },
      signInWithPopup: async () => { calls.popup++; if (options.popupError) throw new FirebaseError(options.popupError); return { credential: { providerId: 'google.com', idToken: 'fixture-google-id-token' } }; },
      signInWithRedirect: async () => { calls.redirects++; },
      signOut: async () => {}, browserSessionPersistence: { type: 'SESSION' },
      setPersistence: async (_auth, persistence) => { calls.persistence.push(persistence); },
    },
    './env': { firebaseConfig: () => JSON.stringify({ apiKey: 'fixture-public-config' }) },
    '@tauri-apps/api/core': { invoke: async (command, args) => {
      calls.invoke.push({ command, args });
      if (options.nativeError) throw options.nativeError;
      return options.nativeResult ?? { provider: 'google', idToken: 'fixture-google-id-token', accessToken: 'fixture-google-access-token' };
    } },
  };
  const modules = new Map();
  for (const [name, values] of Object.entries(exports)) {
    const module = new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context, identifier: name });
    await module.link(() => { throw new Error('Unexpected fixture import'); });
    await module.evaluate();
    modules.set(name, module);
  }
  const source = stripTypeScriptTypes(await readFile(new URL(file, import.meta.url), 'utf8'));
  const module = new vm.SourceTextModule(source, {
    context, identifier: file,
    importModuleDynamically: specifier => {
      assert.ok(modules.has(specifier), `Unexpected dynamic import ${specifier}`);
      return modules.get(specifier);
    },
  });
  await module.link(specifier => {
    assert.ok(modules.has(specifier), `Unexpected import ${specifier}`);
    return modules.get(specifier);
  });
  await module.evaluate();
  await settle();
  return { namespace: module.namespace, calls, elements, storage, location };
}

test('native Google installs the system-browser credential through the exact command', async () => {
  for (const method of ['googleSignIn', 'googleSignInForIdToken']) {
    const run = await execute('./firebase.ts', { native: true });
    const returned = await run.namespace[method]();
    assert.deepEqual(normalize(run.calls.invoke), [{ command: 'native_sign_in', args: { provider: 'google' } }]);
    assert.equal(run.calls.popup, 0);
    assert.deepEqual(normalize(run.calls.installed[0].credential), { idToken: 'fixture-google-id-token', accessToken: 'fixture-google-access-token' });
    assert.equal(returned, method === 'googleSignIn' ? undefined : 'fixture-google-id-token');
  }
});

test('native cancellation maps to the existing error and malformed credentials never install', async () => {
  const cancelled = await execute('./firebase.ts', { native: true, nativeError: 'Sign-in cancelled' });
  await assert.rejects(cancelled.namespace.googleSignIn(), error => error.name === 'SignInCancelledError');
  const failed = await execute('./firebase.ts', { native: true, nativeError: 'Cannot open your system browser.' });
  await assert.rejects(failed.namespace.googleSignIn(), error => error === 'Cannot open your system browser.');
  for (const nativeResult of [null, {}, { provider: 'phone', idToken: 'x' }, { provider: 'google', idToken: '' },
    { provider: 'google', idToken: 'x'.repeat(16385) }, { provider: 'google', idToken: 'x', accessToken: 42 }]) {
    const run = await execute('./firebase.ts', { native: true, nativeResult: nativeResult ?? {} });
    await assert.rejects(run.namespace.googleSignInForIdToken());
    assert.equal(run.calls.installed.length, 0);
  }
});

test('web popup still starts synchronously on the caller gesture without native invocation', async () => {
  for (const method of ['googleSignIn', 'googleSignInForIdToken']) {
    const run = await execute('./firebase.ts');
    const promise = run.namespace[method]();
    assert.equal(run.calls.popup, 1);
    assert.equal(run.calls.invoke.length, 0);
    await promise;
  }
  const blocked = await execute('./firebase.ts', { popupError: 'auth/popup-blocked' });
  await blocked.namespace.googleSignIn();
  assert.equal(blocked.calls.redirects, 1);
});

test('invalid origin, fragment, duplicate, state, provider, port and stored expiry reject before Firebase', async () => {
  const hash = `#port=43021&state=${state}&provider=google`;
  const cases = [
    {}, { origin: 'https://astronatally.com', hash }, { origin: 'http://asknatally.online', hash },
    { hash: `${hash}&port=43022` }, { hash: `${hash}&extra=x` },
    { hash: '#port=43021&provider=google' }, { hash: `#port=29999&state=${state}&provider=google` },
    { hash: `#port=65536&state=${state}&provider=google` }, { hash: `#port=0xA80D&state=${state}&provider=google` },
    { hash: `#port=+43021&state=${state}&provider=google` }, { hash: `#port=43021&state=${'A'.repeat(64)}&provider=google` },
    { hash: `#port=43021&state=${state.slice(1)}&provider=google` }, { hash: `#port=43021&state=${state}&provider=phone` },
    { stored: { ...flow(), startedAt: Date.now() - 300001 } },
    { stored: { ...flow(), startedAt: Date.now() + 60000 } },
    { stored: { ...flow(), token: 'fixture-unexpected-field' } }, { stored: '{broken' },
  ];
  for (const options of cases) {
    const run = await execute('./nativeAuthPage.ts', options);
    assert.match(run.elements.get('native-auth-status').textContent, /Open Natally and choose Sign in again/);
    assert.equal(run.calls.apps.length, 0);
    assert.equal(run.calls.redirects, 0);
    assert.equal(run.calls.forms.length, 0);
    assert.equal(run.storage.has(storageKey), false);
  }
});

test('fresh launch retains only flow metadata, removes fragment, and starts Google once', async () => {
  const run = await execute('./nativeAuthPage.ts', { hash: `#port=43021&state=${state}&provider=google` });
  assert.equal(run.calls.redirects, 1);
  assert.equal(run.calls.redirectResults, 0);
  assert.deepEqual(run.calls.apps, [{ name: 'natally-native-auth' }]);
  assert.equal(run.calls.persistence[0].type, 'SESSION');
  assert.deepEqual(run.calls.history, ['/auth/native.html']);
  assert.equal(run.location.hash, '');
  assert.deepEqual(Object.keys(JSON.parse(run.storage.get(storageKey))).sort(), ['port', 'provider', 'redirecting', 'startedAt', 'state']);
  run.elements.get('native-auth-continue').click();
  await settle();
  assert.equal(run.calls.redirects, 1);
});

test('real-shaped redirect result posts credentials only to the validated loopback form', async () => {
  const run = await execute('./nativeAuthPage.ts', { stored: flow(), redirectResult: {
    providerId: 'google.com', credential: { providerId: 'google.com', idToken: 'fixture-id-token', accessToken: 'fixture-access-token' },
  } });
  assert.equal(run.calls.forms.length, 1);
  const form = run.calls.forms[0];
  assert.equal(form.action, 'http://127.0.0.1:43021/natally-auth');
  assert.equal(form.method, 'POST');
  assert.equal(form.enctype, 'application/x-www-form-urlencoded');
  assert.equal(form.children.length, 1);
  assert.equal(form.children[0].name, 'credential');
  assert.equal(form.children[0].type, 'hidden');
  assert.deepEqual(JSON.parse(form.children[0].value), { state, provider: 'google', idToken: 'fixture-id-token', accessToken: 'fixture-access-token' });
  assert.equal(run.storage.has(storageKey), false);
  assert.equal(run.calls.redirects, 0);
  assert.ok(!form.action.includes('token'));
});

test('cancel submits no token fields and null redirect result cannot restart itself', async () => {
  const run = await execute('./nativeAuthPage.ts', { stored: flow() });
  assert.equal(run.calls.redirects, 0);
  assert.equal(run.calls.forms.length, 0);
  assert.match(run.elements.get('native-auth-status').textContent, /did not return a sign-in result/);
  run.elements.get('native-auth-cancel').click();
  assert.equal(run.calls.forms.length, 1);
  assert.deepEqual(JSON.parse(run.calls.forms[0].children[0].value), { state, provider: 'google', cancelled: true });
  assert.equal(run.storage.has(storageKey), false);
  const retry = await execute('./nativeAuthPage.ts', { stored: flow() });
  retry.elements.get('native-auth-continue').click();
  await settle();
  assert.equal(retry.calls.redirects, 1);
});

test('invalid returned Google credential retains genuine retry and cancel without a callback', async () => {
  const run = await execute('./nativeAuthPage.ts', { stored: flow(), redirectResult: { credential: { providerId: 'google.com' } } });
  assert.equal(run.calls.forms.length, 0);
  assert.equal(run.elements.get('native-auth-continue').disabled, false);
  assert.equal(run.elements.get('native-auth-cancel').disabled, false);
  assert.match(run.elements.get('native-auth-status').textContent, /valid sign-in credential/);
});
