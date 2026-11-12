import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

// The installed TypeScript7 package exposes its native CLI, without a JS
// transpile API. Reuse Vite's installed compiler and retain output in memory.
const compiled = new Map();
for (const file of ['src/services/onboardingProgress.ts', 'src/services/birthDate.ts', 'src/app/AppShell.tsx', 'src/app/onboarding/FirstLight.tsx', 'src/onboarding-original/FirstLight.tsx']) {
 const bundle = await rolldown({ input: resolve(file), external: () => true, logLevel: 'silent', transform: { define: { 'import.meta.env': '{}' } } });
 const generated = await bundle.generate({ format: 'cjs', exports: 'named' });
 compiled.set(resolve(file), generated.output[0].code);
 await bundle.close();
}

// Test-only module substitution leaves the production import graph unchanged.
const load = (file, substitutions = {}, globals = {}) => {
 const full = resolve(file);
 const exports = {};
 const code = compiled.get(full);
 if (!code) throw new Error(`Uncompiled module ${file}`);
 const context = { exports, console, Intl, Date, Map, Set, JSON, Error,

  require(name) {
   if (Object.hasOwn(substitutions, name)) { const value = substitutions[name]; return value && Object.hasOwn(value, 'default') ? value.default : value; }
   if (name.endsWith('.css')) return {};
   if (name.startsWith('.')) return load(resolve(dirname(full), name + '.ts'), substitutions, globals);
   throw new Error(`Unexpected dependency ${name}`);
  },
 };
 Object.defineProperties(context, Object.getOwnPropertyDescriptors(globals));
 vm.runInNewContext(code, context, { filename: full });
 return exports;
};
const memory = () => {
 const data = new Map();
 return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key), data };
};
const gazetteer = [{ id: 'test-toronto', name: 'Toronto', countryCode: 'CA', lat: 43.65, lon: -79.38, tzid: 'America/Toronto' }];
const service = load('src/services/onboardingProgress.ts');
const fullProgress = (uid = 'test-account') => ({
 ...service.createOnboardingProgress(uid),
 answers: { name: 'Regression fixture', date: '1990-06-15', place: 'Toronto, CA', time: '', currentPlace: '' },
 unknownTime: true, skipLocation: true, completed: Array.from(service.ONBOARDING_STEPS), status: 'submitted',
});
const chartFixture = () => ({
 input: { name: 'Regression fixture', dateIso: '1990-06-15', timeIso: null, place: { label: 'Toronto, CA', latitude: 43.65, longitude: -79.38, timezoneIana: 'America/Toronto' } },
 bodies: [{ key: 'Sun', position: { longitude: 83 }, sign: 'Gemini', house: 3 }],
 houses: Array.from({ length: 12 }, (_, i) => ({ house: i + 1, position: { longitude: i * 30 } })),
 ascendant: { longitude: 0 }, midheaven: { longitude: 270 }, aspects: [],
});
const plain = value => JSON.parse(JSON.stringify(value));

test('accepted sections and partially typed answers survive a fresh read', () => {
 const storage = memory();
 const progress = { ...fullProgress(), status: 'draft', completed: ['name', 'date'], answers: { ...fullProgress().answers, place: 'Toron' } };
 assert.equal(service.saveOnboardingProgress(progress, storage), null);
 const loaded = service.loadOnboardingProgress('test-account', gazetteer, storage);
 assert.equal(loaded.progress.answers.place, 'Toron');
 assert.equal(service.firstMissingOnboardingStep(loaded.progress, gazetteer), 2);
 assert.deepEqual(plain(loaded.progress.completed), ['name', 'date']);
});
test('unknown time and explicit location skip are accepted answers', () => {
 const progress = fullProgress();
 assert.equal(service.firstMissingOnboardingStep(progress, gazetteer), 5);
 const draft = service.intakeDraftFromProgress(progress, gazetteer);
 assert.equal(draft.unknownTime, true); assert.equal(draft.time, null); assert.equal(draft.currentLocation, undefined);
 assert.equal(service.firstMissingOnboardingStep({ ...progress, unknownTime: false }, gazetteer), 3);
 assert.equal(service.firstMissingOnboardingStep({ ...progress, skipLocation: false }, gazetteer), 4);
});
test('corruption in one section preserves all independently valid sections', () => {
 const corrupt = fullProgress(); corrupt.answers.date = '1990-02-31';
 const restored = service.normalizeOnboardingProgress(corrupt, 'test-account', gazetteer);
 assert.equal(service.firstMissingOnboardingStep(restored, gazetteer), 1);
 assert.deepEqual(plain(restored.completed), ['name', 'place', 'time', 'currentPlace']);
 assert.equal(restored.status, 'draft');
});
test('wrong owner/version and malformed JSON are never adopted or erased', () => {
 assert.equal(service.normalizeOnboardingProgress(fullProgress('other'), 'test-account', gazetteer), null);
 assert.equal(service.normalizeOnboardingProgress({ ...fullProgress(), version: 2 }, 'test-account', gazetteer), null);
 const storage = memory(); storage.setItem(service.ONBOARDING_PROGRESS_PREFIX + 'test-account', '{broken');
 const result = service.loadOnboardingProgress('test-account', gazetteer, storage);
 assert.equal(result.progress, null); assert.ok(result.error); assert.equal(storage.data.values().next().value, '{broken');
});
test('UID keys isolate both accounts and ignore the unowned legacy stash', () => {
 const storage = memory(); service.saveOnboardingProgress(fullProgress('first/@'), storage);
 assert.ok(storage.getItem(service.ONBOARDING_PROGRESS_PREFIX + encodeURIComponent('first/@')));
 assert.equal(service.loadOnboardingProgress('second', gazetteer, storage).progress, null);
 storage.setItem('natally.firstlight.draft.v1', JSON.stringify(fullProgress('second')));
 assert.equal(service.loadOnboardingProgress('second', gazetteer, storage).progress, null);
 assert.throws(() => service.createOnboardingProgress(''));
});
test('storage property access and read/write exceptions return visible errors', () => {
 const denied = load('src/services/onboardingProgress.ts', {}, Object.defineProperty({}, 'localStorage', { enumerable: true, get() { throw new Error('Denied'); } }));
 assert.ok(denied.loadOnboardingProgress('test-account', gazetteer).error);
 assert.ok(denied.saveOnboardingProgress(fullProgress()));
 const storage = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Quota'); } };
 assert.ok(service.loadOnboardingProgress('test-account', gazetteer, storage).error);
 assert.ok(service.completeOnboardingProgress(fullProgress(), storage));
});
test('completion retains exact answer/consent snapshot', () => {
 const storage = memory(); const progress = fullProgress();
 assert.equal(service.completeOnboardingProgress(progress, storage), null);
 const loaded = service.loadOnboardingProgress('test-account', gazetteer, storage).progress;
 assert.equal(loaded.status, 'complete'); assert.deepEqual(plain(loaded.answers), progress.answers);
 assert.equal(loaded.unknownTime, true); assert.equal(loaded.skipLocation, true);
});
test('masked date text is retained while submission uses the validated ISO date', () => {
 const progress = fullProgress(); progress.answers.date = '1990/06/15';
 assert.equal(service.firstMissingOnboardingStep(progress, gazetteer), 5);
 assert.equal(service.intakeDraftFromProgress(progress, gazetteer).date, '1990-06-15');
 assert.equal(progress.answers.date, '1990/06/15');
});
test('duplicate place labels and invalid device coordinates are validated', () => {
 const duplicate = [...gazetteer, { ...gazetteer[0], id: 'duplicate', tzid: 'America/Vancouver' }];
 const progress = fullProgress();
 assert.equal(service.onboardingSectionValid(progress, 'place', duplicate), false);
 progress.answers.place = 'Toronto, CA — America/Toronto';
 assert.equal(service.intakeDraftFromProgress(progress, duplicate).placeId, 'test-toronto');
 progress.skipLocation = false; progress.deviceLocation = { name: 'Device test', latitude: 200, longitude: 0, timeZone: 'UTC' };
 assert.equal(service.onboardingSectionValid(progress, 'currentPlace', gazetteer), false);
 progress.deviceLocation.latitude = 43;
 assert.equal(service.intakeDraftFromProgress(progress, duplicate).currentLocation.name, 'Device test');
});

// A small hook scheduler executes actual component callbacks without a DOM.
// Full browser behavior and layout are covered by the companion recording.
const harness = (componentFile, extra = {}) => {
 let slots = [], cursor = 0, pending = [], dirty = false, tree, currentProps = {};
 const effects = [];
 const hooks = {
  useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { const next = typeof value === 'function' ? value(slots[i]) : value; if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; } }]; },
  useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
  useMemo(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((x, j) => !Object.is(x, slots[i].deps[j]))) slots[i] = { deps, value: fn() }; return slots[i].value; },
  useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
  useReducer(fn, initial) { const [state, set] = hooks.useState(initial); return [state, action => set(value => fn(value, action))]; },
  useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !deps || deps.some((x, j) => !Object.is(x, slots[i].deps?.[j]))) { slots[i] = { deps }; pending.push(() => { effects[i]?.(); effects[i] = fn(); }); } },
  useId: () => 'regression-id', lazy: () => 'Lazy', Suspense: 'Suspense',
 };
 hooks.useLayoutEffect = hooks.useEffect;
 const win = new EventTarget(); Object.assign(win, { location: { hostname: 'test.invalid', hash: '', pathname: '/app.html', search: '' }, matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }), setTimeout, clearTimeout, setInterval: (...args) => { const timer = setInterval(...args); timer.unref(); return timer; }, clearInterval });
 const document = new EventTarget(); document.getElementById = () => null;
 const storage = extra.storage ?? memory();
 const boundService = load("src/services/onboardingProgress.ts", {}, { localStorage: storage });
 let authCallback;
 const voice = { admitted: false, speaking: false, admit() { this.admitted = true; }, stop() {}, speakStream() {}, onState: () => () => {} };
 const firstLight = function FirstLight() {};
 const substitutions = {
  react: hooks, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' },
  'react-dom': { flushSync: fn => fn() },
  '../platform/firebase': { authUnavailable: false, onAuthChange: callback => { authCallback = callback; callback(extra.user ?? { uid: 'test-account', displayName: 'Test identity' }); return () => {}; } },
  '../services/gazetteer': { loadGazetteer: () => gazetteer }, '../../services/gazetteer': { loadGazetteer: () => gazetteer },
  '../services/onboardingProgress': boundService, '../../services/onboardingProgress': boundService,
  '../services/supertonicTts': { scheduleSupertonicPreload: () => {}, getPreloadedVoice: () => voice },
  '../../services/supertonicTts': { getPreloadedVoice: () => voice },
  '../services/transits': {}, '../services/birthDate': { validateBirthDate: value => ({ isoDate: /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null }) }, './BirthDateFields': { BirthDateFields: 'BirthDateFields' },
  '../chart/astrolabeInput': { computeAstrolabeChart: async () => null }, '../astro/chart': {},
  '../../astro/chart': { natalChart: extra.natalChart ?? (async () => chartFixture()) },
  '../atelier-original/components/Astrolabe3D': { Astrolabe3D: 'Astrolabe3D' }, '../content/lessons': { getLesson: () => ({ title: '', what: '', question: '' }) },
  '../atelier-original/components/ReadingStage': { ReadingStage: 'ReadingStage' }, './stage/Inset': { Inset: 'Inset' },
  './stage/stageMetrics': { useStageVisualHeight: () => 900 }, '../atelier-original/components/atelier/AtelierScene': { AtelierScene: 'AtelierScene' },
  '../../atelier-original/components/atelier/AtelierScene': { AtelierScene: 'AtelierScene' },
  './presentation/state': { initialPresentation: { view: 'atelier', focusTargets: [], sequence: 0 }, presentationReducer: state => state },
  './presentation/playback': { createPlayback: () => ({}) }, './presentation/cues': { parseReply: text => ({ text, cues: [] }) },
  './presentation/opening': { openingReading: () => 'Test reading' }, './presentation/explain': {}, './chat/context': { chartTargets: () => [] },
  './chat/useChat': { useAllowance: () => ({ balanceCr: '0' }) }, './chat/ChatPanel': { ChatPanel: 'ChatPanel' },
  './onboarding/FirstLight': { default: firstLight }, '../../onboarding-original/FirstLight': { default: firstLight },
  './karaokeCaption': { default: 'KaraokeCaption' }, '../content/backstory': {}, './landing/LandingCards': { LandingCards: 'LandingCards', LANDING_SECTIONS: [] },
  './VersionBadge': { default: 'VersionBadge' }, './TopUpSheet': { default: 'TopUpSheet' }, ...extra.substitutions,
 };
 const component = load(componentFile, substitutions, { window: win, document, localStorage: storage, performance, queueMicrotask, ...extra.globals }).default;
 const render = (props = currentProps) => { currentProps = props; let runs = 0; do { dirty = false; cursor = 0; tree = component(props); const work = pending; pending = []; work.forEach(fn => fn()); if (++runs > 25) throw new Error('Render loop'); } while (dirty); return tree; };
 const nodes = (value = tree) => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(x => nodes(x)) : [value, ...nodes(value.props?.children ?? null)];
 return { render, nodes, storage, firstLight, window: win, notify: user => authCallback(user), close: () => effects.forEach(fn => fn?.()) };
};

test('shell restores valid legacy chart before FirstLight and preserves it on same-UID refresh', () => {
 const storage = memory(); const chart = chartFixture(); storage.setItem('natally.chart.v1:test-account', JSON.stringify(chart));
 const h = harness('src/app/AppShell.tsx', { storage }); h.render();
 assert.equal(h.nodes().some(node => node.type === h.firstLight), false);
 h.notify({ uid: 'test-account', displayName: 'Refreshed identity' }); h.render();
 assert.equal(h.nodes().some(node => node.type === h.firstLight), false);
 h.window.dispatchEvent(new Event('pageshow')); h.render();
 assert.equal(h.nodes().some(node => node.type === h.firstLight), false); h.close();
});
test('shell rejects malformed chart and stale account handoff without copying charts across UIDs', () => {
 const storage = memory(); storage.setItem('natally.chart.v1:test-account', JSON.stringify({ input: { dateIso: '1990-06-15' }, bodies: [] }));
 const h = harness('src/app/AppShell.tsx', { storage }); h.render();
 const old = h.nodes().find(node => node.type === h.firstLight);
 assert.ok(old); h.notify({ uid: 'other', displayName: 'Other test identity' }); h.render();
 assert.equal(old.props.onSitDown(chartFixture()), false);
 assert.equal(storage.getItem('natally.chart.v1:other'), null); h.close();
});
test('shell writes chart synchronously before reporting persisted completion', () => {
 const h = harness('src/app/AppShell.tsx'); h.render();
 const flow = h.nodes().find(node => node.type === h.firstLight);
 assert.equal(flow.props.onSitDown(chartFixture()), true);
 assert.ok(h.storage.getItem('natally.chart.v1:test-account')); h.render();
 assert.equal(h.nodes().some(node => node.type === h.firstLight), false); h.close();
});
test('late wrapper calculation is discarded after cancellation/unmount', async () => {
 let resolveChart; let handoffs = 0;
 const h = harness('src/app/onboarding/FirstLight.tsx', { natalChart: () => new Promise(resolve => { resolveChart = resolve; }) });
 h.render({ accountUid: 'test-account', initialProgress: fullProgress(), storageError: null, onSitDown() { handoffs++; return true; }, onCancel() {} });
 h.close(); resolveChart(chartFixture()); await new Promise(resolve => setImmediate(resolve));
 assert.equal(handoffs, 0);
});
test('wrapper writes submitted progress before calculation and completes only after successful chart write', async () => {
 const storage = memory(); let writtenBeforeCalculation = false; let completedBeforeChart = false;
 const h = harness('src/app/onboarding/FirstLight.tsx', { storage, natalChart: async () => { writtenBeforeCalculation = JSON.parse(storage.getItem(service.ONBOARDING_PROGRESS_PREFIX + 'test-account')).status === 'submitted'; return chartFixture(); } });
 h.render({ accountUid: 'test-account', initialProgress: fullProgress(), storageError: null, onSitDown() { completedBeforeChart = JSON.parse(storage.getItem(service.ONBOARDING_PROGRESS_PREFIX + 'test-account')).status === 'complete'; return true; } });
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(writtenBeforeCalculation, true); assert.equal(completedBeforeChart, false);
 assert.equal(JSON.parse(storage.getItem(service.ONBOARDING_PROGRESS_PREFIX + 'test-account')).status, 'complete'); h.close();
});
test('actual questionnaire retains a partial edit and jumps past accepted sections', () => {
 const progress = fullProgress(); progress.status = 'draft'; progress.completed = ['name', 'date', 'time', 'currentPlace']; progress.answers.place = 'Tor';
 let saved;
 const h = harness('src/onboarding-original/FirstLight.tsx');
 h.render({ gazetteer, busy: false, error: null, initialProgress: progress, onProgress: next => { saved = next; }, onCreate() {} });
 let field = h.nodes().find(node => node.props?.id === 'first-light-place');
 assert.equal(field.props.value, 'Tor');
 field.props.onChange({ currentTarget: { value: 'Toronto, CA', selectionStart: 11, scrollLeft: 0 } }); h.render();
 assert.equal(saved.answers.place, 'Toronto, CA'); assert.deepEqual(plain(saved.completed), ['name', 'date', 'time', 'currentPlace']);
 let submitted;
 h.render({ gazetteer, busy: false, error: null, initialProgress: progress, onProgress: next => { saved = next; }, onCreate: draft => { submitted = draft; } });
 h.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: { checkValidity: () => true } });
 assert.equal(saved.status, 'submitted'); assert.equal(submitted.placeId, 'test-toronto'); h.close();
});

test('failed redo chart write retains the existing chart and the recoverable redo', () => {
 const storage = memory(); const original = chartFixture(); storage.setItem('natally.chart.v1:test-account', JSON.stringify(original));
 const write = storage.setItem;
 storage.setItem = (key, value) => { if (key.startsWith('natally.chart.v1:')) throw new Error('Quota'); write(key, value); };
 const h = harness('src/app/AppShell.tsx', { storage }); h.render();
 h.nodes().find(node => node.type.name === 'AccountPanel');
 // The actual account callback remains unreachable until the panel is opened.
 h.nodes().find(node => node.type.name === 'StageHeader').props.onAccount(); h.render();
 const account = h.nodes().find(node => node.type.name === 'AccountPanel');
 account.props.onRedoOnboarding(); h.render();
 const flow = h.nodes().find(node => node.type === h.firstLight);
 assert.equal(flow.props.initialProgress.mode, 'redo');
 const replacement = chartFixture(); replacement.input.name = 'Replacement fixture';
 assert.equal(flow.props.onSitDown(replacement), false); h.render();
 assert.ok(h.nodes().find(node => node.type === h.firstLight));
 assert.deepEqual(JSON.parse(storage.getItem('natally.chart.v1:test-account')), original);
 flow.props.onCancel(); h.render();
 assert.equal(h.nodes().some(node => node.type === h.firstLight), false); h.close();
});
test('completion-record write errors reach the persistent shell error channel', async () => {
 const storage = memory(); const write = storage.setItem; let warning;
 storage.setItem = (key, value) => { if (JSON.parse(value).status === 'complete') throw new Error('Quota'); write(key, value); };
 const h = harness('src/app/onboarding/FirstLight.tsx', { storage });
 h.render({ accountUid: 'test-account', initialProgress: fullProgress(), storageError: null, onSitDown: () => true, onStorageError: message => { warning = message; } });
 await new Promise(resolve => setImmediate(resolve));
 assert.match(warning, /could not be saved/);
 assert.equal(JSON.parse(storage.getItem(service.ONBOARDING_PROGRESS_PREFIX + 'test-account')).status, 'submitted'); h.close();
});
