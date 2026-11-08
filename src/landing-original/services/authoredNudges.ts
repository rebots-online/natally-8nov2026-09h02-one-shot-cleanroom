import { getAtelierMemory, type TrinketId } from './atelierMemories';
import { loadSoulState, rememberCharacterDevelopment, type SoulState } from './soul';

export const AUTHORED_STORY_PREFIX = 'authored-nudge-v1:';
export interface NudgeSettings { enabled: boolean; minSeconds: number; maxSeconds: number; notice: string | null }
export interface NudgeSession { candidates: Map<string, string>; presented: Set<string>; recent: string[] }
export interface AuthoredNudge { id: string; text: string; soul: SoulState; notice: string | null }

export function readNudgeSettings(env: Record<string, string | undefined>): NudgeSettings {
  const enabled = env.VITE_NATALLY_NUDGES_ENABLED;
  const minSeconds = Number(env.VITE_NATALLY_NUDGE_MIN_SECONDS);
  const maxSeconds = Number(env.VITE_NATALLY_NUDGE_MAX_SECONDS);
  const invalid = enabled !== 'true' && enabled !== 'false' ? 'VITE_NATALLY_NUDGES_ENABLED'
    : !Number.isFinite(minSeconds) || minSeconds <= 0 ? 'VITE_NATALLY_NUDGE_MIN_SECONDS'
    : !Number.isFinite(maxSeconds) || maxSeconds < minSeconds || maxSeconds * 1000 > 2_147_483_647 ? 'VITE_NATALLY_NUDGE_MAX_SECONDS' : null;
  return { enabled: !invalid && enabled === 'true', minSeconds, maxSeconds,
    notice: invalid ? `${invalid} is missing or invalid. Spontaneous stories are paused.` : null };
}

const pick = <T,>(values: readonly T[]): T => values[Math.floor(Math.random() * values.length)];
// Each function chooses compatible sentence parts once. Its complete resulting
// text is the immutable character fact, not a fresh variation on every delivery.
const stories = [
  { id: 'school-teacup', create: () => `At psychic school, ${pick(['Professor Thistle', 'Madame Vesper', 'Professor Bellweather'])} asked me to read ${pick(['a blue teacup', 'a chipped porcelain teacup', 'a teacup with a gold handle'])}. I confidently predicted ${pick(['an unexpected visitor', 'a dramatic journey', 'a very important message'])}. It turned out to be the caretaker bringing biscuits. I maintain that biscuits count as important.` },
  { id: 'school-exam', create: () => `My practical exam at psychic school involved ${pick(['a sealed violet envelope', 'a little velvet bag', 'a locked wooden box'])}. Inside was ${pick(['a silver teaspoon', 'a brass button', 'a perfectly ordinary pebble'])}. I described its aura at great length before remembering to describe the object. My examiner wrote, "Promising. Eventually." I kept the note.` },
  { id: 'school-library', create: () => `At psychic school, I once spent ${pick(['a whole lunch break', 'an entire rainy afternoon', 'most of a study period'])} looking for ${pick(['a book on clear thinking', 'a guide to finding lost things', 'the library catalogue'])}. It was ${pick(['under my own notebook', 'in the bag I was carrying', 'on the chair beside me'])}. That remains my most persuasive lesson in checking the obvious first.` },
  { id: 'hotline-first-shift', create: () => `During my one year at the psychic hotline, my first shift began with ${pick(['a flickering desk lamp', 'a headset with one very squeaky hinge', 'a chair that slowly sank'])}. My colleague ${pick(['Mabel', 'Celia', 'Bernard'])} handed me ${pick(['a mug of strong tea', 'a packet of ginger biscuits', 'a neatly folded list of extension numbers'])} and said, "First, listen." That was the best instruction I received there.` },
  { id: 'hotline-hold-music', create: () => `During my one year at the psychic hotline, the hold music was ${pick(['a heroic pan-flute solo', 'a waltz played on a tiny keyboard', 'an extremely earnest harp recording'])}. I heard it so often that I started humming it while ${pick(['watering the office fern', 'sorting the message slips', 'making the evening tea'])}. I left the hotline after that year, but the tune occasionally refuses to leave me.` },
  { id: 'hotline-sign', create: () => `During my one year at the psychic hotline, someone put ${pick(['a crooked handwritten sign', 'a very official laminated notice', 'a note in enormous purple letters'])} above ${pick(['the kettle', 'the staff-room clock', 'the spare headsets'])}. It read, "Please do not predict the end of your shift." I found that ${pick(['finishing my tea', 'tidying my desk', 'checking the actual clock'])} was a more reliable approach anyway.` },
] as const;

function roomReminiscences(uid: string): { id: string; text: string }[] {
  const memory = getAtelierMemory(uid);
  const labels: Partial<Record<TrinketId, string>> = { armillary: 'brass armillary', crystal: 'violet crystal', emerald: 'green crystal', rose: 'rose crystal' };
  return Object.entries(labels).flatMap(([item, label]) => {
    const id = item as TrinketId;
    if (memory.broken.includes(id)) return [{ id: `room:${id}:broken`, text: `My ${label} is in pieces at the moment. A little less ornamental, still very much part of the room. We can take our time here.` }];
    if (memory.taped.includes(id)) return [{ id: `room:${id}:taped`, text: `There is a little tape on my ${label} from its earlier mishap. I rather like belongings with a history. The room still has plenty of room for curiosity.` }];
    return [];
  });
}

function withoutRecent<T extends { id: string }>(values: readonly T[], recent: string[]): T[] {
  const eligible = values.filter(value => !recent.slice(-2).includes(value.id));
  return eligible.length ? eligible : values.filter(value => value.id !== recent.at(-1));
}

/** Preserve disclosed session-only facts in the same SOUL prompt when a write
 * failed. A durable entry always wins over the earlier session candidate. */
export function withNudgeSessionStories(soul: SoulState, session: NudgeSession): SoulState {
  if (!soul.character) return soul;
  const entries = [...soul.character.entries];
  for (const id of session.presented) {
    const text = session.candidates.get(id);
    if (text && !entries.some(entry => entry.id === id)) entries.push({ id, text, at: new Date().toISOString() });
  }
  return { ...soul, character: { ...soul.character, entries } };
}

/** Resolve and synchronously offer speech while holding the character lock.
 * Only the voice service's admission callback may remember the chosen story.
 * Playback is awaited after releasing the lock, never queued behind its audio. */
export async function nextAuthoredNudge(uid: string, session: NudgeSession, isCurrent: () => boolean,
  present: (nudge: AuthoredNudge, rememberAdmission: (isCurrentSession: () => boolean) => SoulState) => Promise<boolean>
): Promise<boolean> {
  if (!isCurrent()) return false;
  const deliver = (nudge: AuthoredNudge, remember?: (isCurrentSession: () => boolean) => SoulState) => {
    let admissionOpen = true;
    let admittedSoul: SoulState | null = null;
    try {
      // The wrapper prevents Promise assimilation from retaining the lock for
      // the utterance. Admission itself runs before the voice service awaits.
      return { playback: present(nudge, current => {
        if (!admissionOpen || !current()) return nudge.soul;
        admittedSoul ??= remember ? remember(current) : nudge.soul;
        return admittedSoul;
      }) };
    } finally { admissionOpen = false; }
  };
  const room = withoutRecent(roomReminiscences(uid), session.recent);
  if (room.length && Math.random() < .25) {
    const selected = pick(room);
    return deliver({ ...selected, soul: loadSoulState(uid), notice: null }).playback;
  }
  const choices = stories.map(story => ({ ...story, id: AUTHORED_STORY_PREFIX + story.id }));
  const selected = pick(withoutRecent(choices, session.recent));
  const resolve = () => {
    if (!isCurrent()) return null;
    const fresh = loadSoulState(uid);
    const known = fresh.character?.entries.find(entry => entry.id === selected.id);
    if (known) {
      session.candidates.set(selected.id, known.text);
      return deliver({ id: selected.id, text: known.text, soul: fresh, notice: fresh.notice });
    }
    let candidate = session.candidates.get(selected.id);
    if (!candidate) { candidate = selected.create(); session.candidates.set(selected.id, candidate); }
    if (fresh.notice || !navigator.locks) {
      return deliver({ id: selected.id, text: candidate, soul: fresh,
        notice: fresh.notice || 'This story is available for this conversation only; coordinated character memory is unavailable in this browser.' });
    }
    const nudge: AuthoredNudge = { id: selected.id, text: candidate, soul: fresh, notice: fresh.notice };
    return deliver(nudge, current => {
      const saved = rememberCharacterDevelopment(fresh, { id: selected.id, text: nudge.text }, current);
      const readback = loadSoulState(uid);
      const winner = readback.character?.entries.find(entry => entry.id === selected.id);
      if (winner) {
        session.candidates.set(selected.id, winner.text);
        nudge.soul = readback;nudge.notice = readback.notice;
      } else {
        nudge.soul = saved;
        nudge.notice = saved.notice || readback.notice || 'This story could not be saved. It is available for this conversation only.';
      }
      return nudge.soul;
    });
  };
  // Nudge writers in other tabs share this lock, so only the first creation
  // chooses facts. Subsequent writers reload and use that established entry.
  const dispatched = navigator.locks ? await navigator.locks.request(`natally-character-stories:${uid}`, resolve) : resolve();
  return dispatched ? dispatched.playback : false;
}
