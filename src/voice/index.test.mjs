import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8');
const preparationSource = await readFile(new URL('../atelier-original/services/voiceService.ts', import.meta.url), 'utf8');
const preparationStart = preparationSource.indexOf('export function prepareSpeechWithOffsets(');
const preparationEnd = preparationSource.indexOf('\nlet sharedAudioContext', preparationStart);
assert.ok(preparationStart >= 0 && preparationEnd > preparationStart, 'the production normalization region exists');
const normalizationSource = preparationSource.slice(preparationStart, preparationEnd);
const compile = text => stripTypeScriptTypes(text, { mode: 'strip' });
const tick = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };

async function harness() {
  const plays = [];
  const events = [];
  const context = createContext({
    console,
    Error,
    navigator: {},
    window: { dispatchEvent: event => { events.push(event); return true; } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
  });
  const preparation = new SourceTextModule(compile(normalizationSource), { context });
  await preparation.link(() => { throw new Error('normalization must remain self-contained'); });
  await preparation.evaluate();
  const prepareSpeechWithOffsets = preparation.namespace.prepareSpeechWithOffsets;
  const dependencies = {
    initSupertonic: async () => {},
    splitSpeechText: text => [text],
    subscribeVoiceStatus: callback => { callback({ phase: 'ready' }); return () => {}; },
    supertonicSpeak: async () => { throw new Error('prefetch is disabled in this controlled playback test'); },
    getSharedAudioContext: () => null,
    getSpeechPolicy: () => ({ prefetch: false, chunkChars: 180 }),
    loadVoiceSettings: () => ({ rate: 1, aiVoiceName: 'F4', resourceMode: 'auto' }),
    prepareSpeechWithOffsets,
    speakNatallyText: (line, _settings, _a, _b, onWord) => new Promise((resolve, reject) => {
      plays.push({ line, resolve, reject, onWord });
    }),
    stopSpeaking: () => {},
  };
  const module = new SourceTextModule(compile(source), { context });
  await module.link(() => new SyntheticModule(Object.keys(dependencies), function () {
    for (const [name, value] of Object.entries(dependencies)) this.setExport(name, value);
  }, { context }));
  await module.evaluate();
  return { voice: module.namespace.createVoice(), plays, events, prepareSpeechWithOffsets };
}

test('completion waits for the last queued playback and runs exactly once', async () => {
  const { voice, plays } = await harness();
  let completed = 0;
  voice.admit();
  voice.speakStream('First sentence.');
  await tick();
  voice.speakStream('Last sentence.', { flush: true, onComplete: () => completed++ });
  assert.equal(completed, 0);
  plays[0].resolve(true);
  await tick();
  assert.equal(plays.length, 2);
  assert.equal(completed, 0);
  plays[1].resolve(true);
  await tick();
  assert.equal(completed, 1);
  voice.speakStream('', { flush: true, onComplete: () => completed++ });
  await tick();
  assert.equal(completed, 1, 'an empty new utterance is not successful playback');
});

test('temporary empty queues in an unfinished stream do not complete', async () => {
  const { voice, plays } = await harness();
  let completed = 0;
  voice.admit();
  voice.speakStream('First.', { onComplete: () => completed++ });
  await tick();
  plays[0].resolve(true);
  await tick();
  assert.equal(completed, 0);
  voice.speakStream('More.');
  await tick();
  plays[1].resolve(true);
  await tick();
  assert.equal(completed, 0);
  voice.speakStream('', { flush: true });
  await tick();
  assert.equal(completed, 1, 'a later final flush completes an already drained utterance');
});

test('unadmitted speech cannot complete before admission and real playback', async () => {
  const { voice, plays } = await harness();
  let completed = 0;
  voice.speakStream('Waiting for a gesture.', { flush: true, onComplete: () => completed++ });
  await tick();
  assert.equal(plays.length, 0);
  assert.equal(completed, 0);
  voice.admit();
  await tick();
  plays[0].resolve(true);
  await tick();
  assert.equal(completed, 1);
});

test('false playback cancels the remaining queue and completion', async () => {
  const { voice, plays } = await harness();
  let completed = 0;
  voice.admit();
  voice.speakStream('First.');
  await tick();
  voice.speakStream('Must not follow.', { flush: true, onComplete: () => completed++ });
  plays[0].resolve(false);
  await tick();
  assert.equal(plays.length, 1);
  assert.equal(completed, 0);
});

test('playback error discards completion and reports the engine error', async () => {
  const { voice, plays } = await harness();
  let completed = 0;
  let latest;
  voice.onState(state => { latest = state; });
  voice.admit();
  voice.speakStream('Cannot play.', { flush: true, onComplete: () => completed++ });
  await tick();
  plays[0].reject(new Error('controlled playback failure'));
  await tick();
  assert.equal(completed, 0);
  assert.equal(latest.error, 'controlled playback failure');
  assert.equal(latest.speaking, false);
});

for (const failure of ['false', 'error']) {
  test(`${failure} before the final flush cannot complete a partially failed stream`, async () => {
    const { voice, plays } = await harness();
    let completed = 0;
    voice.admit();
    voice.speakStream('First.');
    await tick();
    if (failure === 'false') plays[0].resolve(false);
    else plays[0].reject(new Error('early playback failure'));
    await tick();
    voice.speakStream('Later delta.');
    voice.speakStream('', { flush: true, onComplete: () => completed++ });
    await tick();
    assert.equal(plays.length, 1, 'the rest of the failed stream is discarded');
    assert.equal(completed, 0);
    voice.speakStream('A new reading.', { flush: true, onComplete: () => completed++ });
    await tick();
    assert.equal(plays.length, 2);
    plays[1].resolve(true);
    await tick();
    assert.equal(completed, 1, 'a subsequent complete reading can succeed');
  });
}

test('stop invalidates even a late successful playback acknowledgement', async () => {
  const { voice, plays } = await harness();
  let completed = 0;
  voice.admit();
  voice.speakStream('Old target.', { flush: true, onComplete: () => completed++ });
  await tick();
  voice.stop();
  plays[0].resolve(true);
  await tick();
  assert.equal(completed, 0);
});

test('supersession cannot complete the old target or clear the new one', async () => {
  const { voice, plays } = await harness();
  const completed = [];
  voice.admit();
  voice.speakStream('Old target.', { flush: true, onComplete: () => completed.push('old') });
  await tick();
  voice.speakStream('New target.', { flush: true, onComplete: () => completed.push('new') });
  plays[0].resolve(true);
  await tick();
  assert.equal(plays.length, 2);
  assert.deepEqual(completed, []);
  plays[1].resolve(true);
  await tick();
  assert.deepEqual(completed, ['new']);
});

test('a new interaction in the idle notification discards the old completion', async () => {
  const { voice, plays } = await harness();
  let completed = 0;
  let wasSpeaking = false;
  voice.onState(state => {
    if (wasSpeaking && !state.speaking) { wasSpeaking = false; voice.stop(); }
    else wasSpeaking = state.speaking;
  });
  voice.admit();
  voice.speakStream('Target.', { flush: true, onComplete: () => completed++ });
  await tick();
  plays[0].resolve(true);
  await tick();
  assert.equal(completed, 0);
});

test('atelier pronunciation preserves source offsets beside expanded degrees', async () => {
  const { prepareSpeechWithOffsets } = await harness();
  const display = 'Welcome to the ATELIER at 1°20′, atelier. No ateliers or atelierish.';
  const result = prepareSpeechWithOffsets(display);
  assert.equal(result.text, 'Welcome to the ah-tell-yay at 1 degree, 20 arcminutes, ah-tell-yay. No ateliers or atelierish.');
  assert.equal(result.text.length, result.sourceOffsets.length);
  for (let index = 0; index < result.sourceOffsets.length; index++) {
    assert.ok(result.sourceOffsets[index] >= 0 && result.sourceOffsets[index] < display.length);
    if (index > 0) assert.ok(result.sourceOffsets[index] >= result.sourceOffsets[index - 1]);
  }
  for (const match of result.text.matchAll(/ah-tell-yay/g)) {
    const offsets = Array.from(result.sourceOffsets.slice(match.index, match.index + match[0].length));
    assert.equal(display.slice(offsets[0], offsets.at(-1) + 1).toLowerCase(), 'atelier');
  }
  assert.equal(display, 'Welcome to the ATELIER at 1°20′, atelier. No ateliers or atelierish.');
});
