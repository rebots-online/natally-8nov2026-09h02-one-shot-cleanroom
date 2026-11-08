export type InteractionSurface = 'marketing' | 'app';
export type InteractionInputMethod = 'pointer' | 'touch' | 'keyboard' | 'chat' | 'voice' | 'unknown';
export type InteractionFields = Readonly<Record<string, unknown>>;
export type InteractionEvent = 'chart_item_hover' | 'chart_item_focus' | 'chart_item_select' | 'education_answer' |
  'scene_view_change' | 'trinket_interaction' | 'trinket_break' | 'crystal_ball_interaction' |
  'world_interval' | 'world_transition' | 'voice_playback' | 'interface_action';
export type InteractionContext = {
  scene: 'atelier' | 'chart' | 'none';
  panel: 'world' | 'account' | 'conversation' | 'menu';
  listening: boolean;
  visible: boolean;
  source: 'user_action' | 'automatic_scroll_swap' | 'narration' | 'lifecycle';
  paid_access_state: 'available' | 'unavailable' | 'unknown';
};

const eventNames = new Set<InteractionEvent>(['chart_item_hover', 'chart_item_focus', 'chart_item_select', 'education_answer',
  'scene_view_change', 'trinket_interaction', 'trinket_break', 'crystal_ball_interaction', 'world_interval',
  'world_transition', 'voice_playback', 'interface_action']);
const actionEventNames = new Set<InteractionEvent>(['chart_item_hover', 'chart_item_focus', 'chart_item_select', 'education_answer',
  'trinket_interaction', 'trinket_break', 'crystal_ball_interaction', 'interface_action']);
const categories: Record<string, ReadonlySet<string>> = Object.fromEntries(Object.entries({
  surface: ['marketing', 'app'], scene: ['atelier', 'chart', 'none'], from_scene: ['atelier', 'chart', 'none'], to_scene: ['atelier', 'chart', 'none'],
  from_view: ['atelier', 'chart'], to_view: ['atelier', 'chart'],
  panel: ['world', 'account', 'conversation', 'menu'], from_panel: ['world', 'account', 'conversation', 'menu'], to_panel: ['world', 'account', 'conversation', 'menu'],
  source: ['user_action', 'automatic_scroll_swap', 'narration', 'lifecycle'],
  paid_access_state: ['available', 'unavailable', 'unknown'],
  input_method: ['pointer', 'touch', 'keyboard', 'chat', 'voice', 'unknown'],
  activity_kind: ['education', 'user_question', 'horoscope', 'synastry', 'room_play', 'navigation', 'promotion'],
  response_mode: ['authored_free', 'paid_personal', 'no_response'],
  entry_point: ['chart_object', 'placement_select', 'scene_prop', 'chat', 'voice', 'replay', 'voice_control', 'account', 'automatic_scene_transition', 'inset'],
  action: ['pointer_entry', 'nudge', 'pickup', 'drag', 'drop', 'return', 'break', 'caress', 'pulse', 'focus', 'select', 'open', 'close', 'start', 'end', 'replay', 'stop'],
  status: ['started', 'completed', 'failed', 'cancelled'],
  object_kind: ['hourglass', 'armillary', 'crystal', 'emerald', 'rose', 'vial', 'crystal_ball'],
  target_kind: ['planet', 'sign', 'house', 'aspect', 'current_planet', 'current_aspect', 'origin'],
}).map(([key, values]) => [key, new Set(values)]));

const planetNames = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
  'Chiron', 'TrueNode', 'Ceres', 'Pallas', 'Juno', 'Vesta', 'Lilith', 'North Node', 'South Node', 'Ascendant', 'Midheaven', 'Earth'];
const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const slug = (value: string) => value.toLowerCase().replace(/ /g, '_');
const targetIds = new Set<string>();
for (const name of planetNames) { targetIds.add('planet_' + slug(name)); targetIds.add('now_' + slug(name)); }
for (const name of signs) targetIds.add('sign_' + slug(name));
for (let house = 1; house <= 12; house++) targetIds.add('house_' + house);
targetIds.add('origin_earth');
const aspects: Record<string, string> = { '☌': 'conjunction', '☍': 'opposition', '□': 'square', '△': 'trine', '⚹': 'sextile' };
for (const left of planetNames) for (const right of planetNames) for (const aspect of Object.values(aspects)) {
  targetIds.add(`aspect_${slug(left)}_${aspect}_${slug(right)}`);
  targetIds.add(`now_aspect_${slug(left)}_${aspect}_${slug(right)}`);
}

/** Only the renderer's known content inventory is projected; chart text and timestamps are never forwarded. */
export function chartAnalyticsTarget(rawId: unknown): { target_kind: string; target_id: string } | null {
  if (typeof rawId !== 'string') return null;
  const raw = rawId.replace(/ @ \d{4}-\d{2}-\d{2}T[\d:.]+Z$/, '');
  if (raw === 'Earth (Geocentric Origin)') return { target_kind: 'origin', target_id: 'origin_earth' };
  const name = planetNames.find(candidate => candidate === raw);
  if (name) return { target_kind: 'planet', target_id: 'planet_' + slug(name) };
  const sign = signs.find(candidate => candidate === raw);
  if (sign) return { target_kind: 'sign', target_id: 'sign_' + slug(sign) };
  const house = /^House ([1-9]|1[0-2])$/.exec(raw);
  if (house) return { target_kind: 'house', target_id: 'house_' + house[1] };
  const now = planetNames.find(candidate => raw === 'Now ' + candidate);
  if (now) return { target_kind: 'current_planet', target_id: 'now_' + slug(now) };
  const match = /^(Now )?(.+) ([☌☍□△⚹]) (?:[Nn]atal )?(.+) \((0|60|90|120|180)°\)$/.exec(raw);
  if (!match || !planetNames.includes(match[2]) || !planetNames.includes(match[4])) return null;
  const angles: Record<string, string> = { '☌': '0', '☍': '180', '□': '90', '△': '120', '⚹': '60' };
  if (angles[match[3]] !== match[5]) return null;
  return { target_kind: match[1] ? 'current_aspect' : 'aspect', target_id: `${match[1] ? 'now_aspect' : 'aspect'}_${slug(match[2])}_${aspects[match[3]]}_${slug(match[4])}` };
}

type GoogleTag = (...args: unknown[]) => void;
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: GoogleTag };
let surface: InteractionSurface | null = null;
let measurementId: string | null = null;
let sendTag: GoogleTag | null = null;
let sequence = 0;
let pageSuspended = false;
let requested: InteractionContext = { scene: 'none', panel: 'world', listening: false, visible: false, source: 'lifecycle', paid_access_state: 'unknown' };
let context = { ...requested };
let interval: { at: number; fields: InteractionContext } | null = null;

export type ConfirmedRedemptionAnalyticsReceipt = Readonly<{
  /** Actual account-scoped receipt identifier; never transmitted to Analytics. */
  receiptId: string;
  allowanceUsdMicros: number;
}>;
let redemptionReceipt: ConfirmedRedemptionAnalyticsReceipt | null = null;
let pendingRedemptionCompletion = false;
const reportedRedemptionReceipts = new Set<string>();

function checkedRedemptionReceipt(receipt: ConfirmedRedemptionAnalyticsReceipt): ConfirmedRedemptionAnalyticsReceipt {
  if (!receipt || typeof receipt.receiptId !== 'string' || !receipt.receiptId.trim() ||
      !Number.isSafeInteger(receipt.allowanceUsdMicros) || receipt.allowanceUsdMicros <= 0) {
    throw new Error('Redemption analytics requires an authoritative receipt and positive monetary allowance.');
  }
  return { receiptId: receipt.receiptId, allowanceUsdMicros: receipt.allowanceUsdMicros };
}

function publishRedemptionAnalytics(): void {
  if (!sendTag || !measurementId || !surface) return;
  try {
    // Only this property is changed; purchase/subscription classification is retained.
    sendTag('set', 'user_properties', { access_origin: redemptionReceipt ? 'redeemed_code' : null });
    if (!redemptionReceipt || !pendingRedemptionCompletion) return;
    if (reportedRedemptionReceipts.has(redemptionReceipt.receiptId)) {
      pendingRedemptionCompletion = false;
      return;
    }
    sendTag('event', 'redemption_completed', {
      ...pageFields(), send_to: measurementId,
      allowance_usd: redemptionReceipt.allowanceUsdMicros / 1000000,
    });
    reportedRedemptionReceipts.add(redemptionReceipt.receiptId);
    pendingRedemptionCompletion = false;
  } catch { /* Analytics must not interrupt granted access; enqueueing is not delivery proof. */ }
}

/** Restore only from an authoritative account receipt. Pass null on logout/account change.
 * Restoration never counts as a new redemption; receipt IDs stay in memory only. */
export function restoreRedemptionAnalytics(receipt: ConfirmedRedemptionAnalyticsReceipt | null): void {
  const restored = receipt === null ? null : checkedRedemptionReceipt(receipt);
  if (!restored || restored.receiptId !== redemptionReceipt?.receiptId) pendingRedemptionCompletion = false;
  redemptionReceipt = restored;
  publishRedemptionAnalytics();
}

/** Call only after the runtime confirms a durable grant AND usable conversation access.
 * Never call for an attempt, pending grant, failed provisioning, or receipt restoration. */
export function trackRedemptionCompleted(receipt: ConfirmedRedemptionAnalyticsReceipt): void {
  redemptionReceipt = checkedRedemptionReceipt(receipt);
  pendingRedemptionCompletion = !reportedRedemptionReceipts.has(redemptionReceipt.receiptId);
  publishRedemptionAnalytics();
}

const identifier = () => 'interaction_' + Date.now().toString(36) + '_' + (++sequence).toString(36);
const now = () => performance.now();
const pageFields = () => ({
  page_location: window.location.origin + window.location.pathname,
  page_referrer: (() => { try { const referrer = new URL(document.referrer); return /^https?:$/.test(referrer.protocol) ? referrer.origin : ''; } catch { return ''; } })(),
  page_title: surface === 'marketing' ? 'Natally marketing' : 'Natally app',
});

function bounded(fields: InteractionFields): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'duration_ms' && typeof value === 'number' && Number.isFinite(value) && value >= 0) result[key] = Math.round(value);
    else if (['listening', 'visible', 'from_listening', 'to_listening', 'from_visible', 'to_visible'].includes(key) && typeof value === 'boolean') result[key] = value;
    else if (key === 'target_id' && typeof value === 'string' && targetIds.has(value)) result[key] = value;
    else if (typeof value === 'string' && categories[key]?.has(value)) result[key] = value;
  }
  return result;
}

function emit(name: InteractionEvent, fields: InteractionFields, ownedContext = context, episodeId?: string) {
  if (!surface || !measurementId || !sendTag || !eventNames.has(name)) return;
  const eventSource = actionEventNames.has(name) ? {source:'user_action'} : name === 'voice_playback' ? {source:'narration'} : {};
  try {
    sendTag('event', name, { ...pageFields(), ...bounded({ surface, ...ownedContext, ...fields, ...eventSource }),
      send_to: measurementId, event_id: identifier(), ...(episodeId ? { episode_id: episodeId } : {}) });
  } catch { /* Collection cannot interrupt an interaction; enqueueing is not delivery proof. */ }
}

export function trackInteraction(name: InteractionEvent, fields: InteractionFields = {}): void {
  emit(name, fields);
}

export function beginInteractionEpisode(name: InteractionEvent, fields: InteractionFields = {}): (outcome?: 'completed' | 'cancelled') => void {
  const id = identifier(), startedAt = now(), initial = { ...context }, safeFields = bounded(fields);
  let ended = false;
  emit(name, { ...safeFields, status: 'started' }, initial, id);
  return (outcome = 'completed') => {
    if (ended) return;
    ended = true;
    emit(name, { ...safeFields, status: outcome, duration_ms: Math.max(0, now() - startedAt) }, initial, id);
  };
}

function applyContext(next: InteractionContext) {
  const changed = (['scene', 'panel', 'listening', 'visible', 'paid_access_state'] as const).some(key => next[key] !== context[key]);
  if (!changed) { context = next; return; }
  const at = now(), previous = context;
  if (interval) {
    emit('world_interval', { duration_ms: Math.max(0, at - interval.at), status: 'completed' }, interval.fields);
    interval = null;
  }
  context = next;
  emit('world_transition', { from_scene: previous.scene, to_scene: next.scene, from_panel: previous.panel, to_panel: next.panel,
    from_listening: previous.listening, to_listening: next.listening, from_visible: previous.visible, to_visible: next.visible, source: next.source });
  if (previous.scene !== next.scene && previous.scene !== 'none' && next.scene !== 'none') {
    emit('scene_view_change', { from_view: previous.scene, to_view: next.scene, source: next.source, activity_kind: 'navigation', response_mode: 'no_response' });
  }
  if (next.visible && next.scene !== 'none' && (next.panel === 'world' || next.panel === 'conversation')) interval = { at, fields: { ...next } };
}

export function updateInteractionContext(partial: Partial<InteractionContext>): void {
  const contextKeys = new Set(['scene', 'panel', 'listening', 'visible', 'source', 'paid_access_state']);
  const safe = Object.fromEntries(Object.entries(bounded(partial)).filter(([key]) => contextKeys.has(key)));
  requested = { ...requested, ...safe } as InteractionContext;
  applyContext({ ...requested, visible: requested.visible && !document.hidden && !pageSuspended });
}

/** Standard Google tag bootstrap; called only by an actual rendered web entry. */
export function initializeInteractionAnalytics(nextSurface: InteractionSurface): void {
  if (surface || '__TAURI_INTERNALS__' in window) return;
  const configured = String(import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim();
  if (!configured) return;
  if (!/^G-[A-Z0-9]+$/.test(configured)) throw new Error('Invalid VITE_GA_MEASUREMENT_ID');
  surface = nextSurface;
  measurementId = configured;
  interval = null;
  context = { ...requested, visible: requested.visible && !document.hidden && !pageSuspended };
  if (context.visible && context.scene !== 'none' && (context.panel === 'world' || context.panel === 'conversation')) interval = { at: now(), fields: { ...context } };
  const host = window as AnalyticsWindow;
  host.dataLayer = host.dataLayer || [];
  host.gtag = host.gtag || function () { host.dataLayer!.push(arguments); };
  sendTag = host.gtag;
  sendTag('js', new Date());
  sendTag('set', { ...pageFields(), send_page_view: false });
  sendTag('config', configured, { ...pageFields(), send_page_view: false });
  publishRedemptionAnalytics();
  const scriptId = 'natally-google-tag';
  if (!document.getElementById(scriptId)) {
    const script = document.createElement('script');
    script.id = scriptId;script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + configured;
    document.head.appendChild(script);
  }
  sendTag('event', 'page_view', { ...pageFields(), surface: nextSurface, send_to: configured });
  const visibility = () => applyContext({ ...requested, visible: requested.visible && !document.hidden && !pageSuspended, source: 'lifecycle' });
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', () => { pageSuspended = true;visibility(); });
  window.addEventListener('pageshow', () => { pageSuspended = false;visibility(); });
}
