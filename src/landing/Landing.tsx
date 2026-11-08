// The landing IS the product (operator parity directive 2026-11-08, after
// auditing the original at natally.robin.mba): the verbatim atelier scene
// with breakable trinkets, the draggable+resizable inset example chart
// ('⠿ Move chart' handle), her Sound On toggle (part of the scene), an
// 'Explore a placement' selector over every planet/sign/house/aspect of
// the example wheel — clicking one has her explain it aloud (karaoke glow,
// chart highlight, today's live sky for planets) — the Aurelia example
// caption, and one CTA. No marketing sections; one screen, nothing scrolls
// away. Version badge bottom-right; voice truthfully gated on a gesture.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { AtelierScene } from '../atelier-original/components/atelier/AtelierScene';
import { Astrolabe3D } from '../atelier-original/components/Astrolabe3D';
import VersionBadge from '../app/VersionBadge';
import KaraokeCaption from '../app/karaokeCaption';
import { withPerformanceEvents } from '../app/voicePerformance';
import { computeAstrolabeChart, type NatalChartResult } from '../chart/astrolabeInput';
import { composeLiveReading } from '../chart/liveReading';
import type { BirthInput, ChartBodyKey } from '../shared/types';
import type { Voice, VoiceState } from '../voice';
import { getPreloadedVoice } from '../services/supertonicTts';
import './landing.css';

/** The example wheel's birth data (caption below is its honest label). */
const EXAMPLE_BIRTH: BirthInput = {
  name: 'Aurelia',
  dateIso: '1997-11-08',
  timeIso: '19:05',
  place: {
    label: 'Toronto, Canada',
    latitude: 43.70643,
    longitude: -79.39864,
    timezoneIana: 'America/Toronto',
  },
};

const EXAMPLE_CAPTION =
  'Example chart — Aurelia, an anonymous example born 8 Nov 1997, 7:05 PM, Toronto. It is not your chart.';
const WELCOME_LINE =
  "Okay hi, come in — mind the crystals, I taped one back together like last week and I'm not doing that again. The shelves are grabbable, all of it, I only side-eye a little. The little wheel is Aurelia's chart; poke anything in it, or the menu below, and I'll tell you what the sky is doing. Today's sky included — I checked.";

const SIGN_NOTES: Record<string, string> = {
  Aries: "Aries — cardinal fire, the door kicked open. Zero hesitation, occasionally zero plan.",
  Taurus: 'Taurus — fixed earth. Comfort as a philosophy; slow to move, impossible to rush.',
  Gemini: 'Gemini — mutable air, three browser tabs of a personality. In a good way.',
  Cancer: 'Cancer — cardinal water. The tide remembers everything; the shell is load-bearing.',
  Leo: 'Leo — fixed fire, main-character radiation. Warm on purpose, not by accident.',
  Virgo: 'Virgo — mutable earth, the annotated life. Caring, in spreadsheet form.',
  Libra: 'Libra — cardinal air. Beauty, balance, and seventeen minutes choosing a playlist.',
  Scorpio: 'Scorpio — fixed water. Deep end only; the lifeguard is also emotionally invested.',
  Sagittarius: 'Sagittarius — mutable fire. Horizon as a residence. Snack included.',
  Capricorn: 'Capricorn — cardinal earth. Legacy energy; the mountain is a to-do list.',
  Aquarius: 'Aquarius — fixed air. Twenty minutes ahead of the group chat, always.',
  Pisces: 'Pisces — mutable water. Porous, dreamy, quietly the most honest one here.',
};

const ASPECT_RIFFS: Record<string, string> = {
  Conjunction: 'These two share one brain cell, politely.',
  Sextile: 'A small open door — nudge it and it swings.',
  Square: 'Homework with feelings. Growth-shaped, annoyingly.',
  Trine: 'Free real estate; the two just get each other.',
  Opposition: 'Across-the-table energy. Fascinating, negotiable.',
};

type PlacementGroup = 'Planets' | 'Signs' | 'Houses' | 'Aspects';

interface PlacementOption {
  readonly id: string;
  readonly group: PlacementGroup;
  readonly label: string;
  readonly highlight: readonly string[];
  readonly explain: () => string;
}

export default function Landing() {
  // The example wheel + today's sky, computed once with the renderer's own
  // verbatim pipeline (on-device).
  const [example, setExample] = useState<NatalChartResult | null>(null);
  const [today, setToday] = useState<NatalChartResult | null>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [highlight, setHighlight] = useState<readonly string[]>([]);
  const [selected, setSelected] = useState('');
  // Inset drag: free across the whole viewport, bounded only by the screen.
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ id: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const dragLimits = useRef({ minX: -220, maxX: 220, minY: -160, maxY: 160 });
  // Inset resize: corner handle adjusts width; layoutKey bumps on release
  // so the renderer re-rasterizes crisp at the new size.
  const [panelWidth, setPanelWidth] = useState<number | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);
  const resizeState = useRef<{ id: number; startX: number; base: number } | null>(null);

  const voiceRef = useRef<Voice | null>(null);
  if (voiceRef.current === null) voiceRef.current = withPerformanceEvents(getPreloadedVoice());
  const voice = voiceRef.current;
  const [voiceState, setVoiceState] = useState<VoiceState>({ admitted: false, speaking: false, error: null });
  const currentLine = useRef(WELCOME_LINE);

  useEffect(() => {
    let live = true;
    computeAstrolabeChart(EXAMPLE_BIRTH)
      .then(result => {
        if (live) setExample(result);
      })
      .catch(() => {
        if (live) setExample(null);
      });
    computeAstrolabeChart({
      ...EXAMPLE_BIRTH,
      dateIso: new Date().toISOString().slice(0, 10),
      timeIso: new Date().toTimeString().slice(0, 5),
    })
      .then(result => {
        if (live) setToday(result);
      })
      .catch(() => {
        if (live) setToday(null);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  useEffect(() => voice.onState(setVoiceState), [voice]);

  // First gesture admits audio and she greets — with the shelf invitation.
  useEffect(() => {
    const admit = () => {
      if (voice.admitted) return;
      voice.admit();
      voice.speakStream(currentLine.current, { flush: true });
    };
    window.addEventListener('pointerdown', admit, { once: true });
    window.addEventListener('keydown', admit, { once: true });
    return () => {
      window.removeEventListener('pointerdown', admit);
      window.removeEventListener('keydown', admit);
    };
  }, [voice]);

  useEffect(() => () => voice.stop(), [voice]);

  const speak = (line: string) => {
    currentLine.current = line;
    if (!voice.admitted) return; // the next gesture speaks it
    voice.stop();
    voice.speakStream(line, { flush: true });
  };

  /** Every explorable placement of the example wheel. */
  const options = useMemo<readonly PlacementOption[]>(() => {
    if (!example) return [];
    const built: PlacementOption[] = [];
    for (const body of example.natalBodies) {
      const current = today?.natalBodies.find(candidate => candidate.name === body.name) ?? null;
      built.push({
        id: `planet:${body.name}`,
        group: 'Planets',
        label: `${body.glyph} ${body.name} — ${body.fullDegText}`,
        highlight: [body.name],
        explain: () =>
          composeLiveReading(
            body.name as ChartBodyKey,
            { sign: body.signName, lon: body.lon },
            current ? { sign: current.signName, lon: current.lon } : null,
          ),
      });
    }
    for (const sign of new Set(example.natalBodies.map(body => body.signName))) {
      built.push({
        id: `sign:${sign}`,
        group: 'Signs',
        label: sign,
        highlight: [`sign_${sign}`],
        explain: () => {
          const holders = example.natalBodies.filter(body => body.signName === sign).map(body => body.name);
          return `${SIGN_NOTES[sign] ?? `${sign}.`} Currently holding: ${holders.length ? holders.join(', ') : 'nothing — it is resting.'}`;
        },
      });
    }
    for (let house = 1; house <= 12; house += 1) {
      built.push({
        id: `house:${house}`,
        group: 'Houses',
        label: `House ${house}`,
        highlight: [`House ${house}`],
        explain: () => {
          const residents = example.natalBodies.filter(body => body.house === house).map(body => body.name);
          return `House ${house} — one room of the wheel, one part of a life.${residents.length ? ` Aurelia keeps ${residents.join(' and ')} in this one.` : ' Empty in this chart, which is not a problem — it just is not where the action is.'}`;
        },
      });
    }
    for (const chord of example.aspectChords) {
      built.push({
        id: `aspect:${chord.name}`,
        group: 'Aspects',
        label: `${chord.from} ${chord.symbol} ${chord.to} (${chord.angle}°)`,
        highlight: [chord.name],
        explain: () =>
          `${chord.from} ${chord.symbol} ${chord.to} — a ${chord.type.toLowerCase()}, ${chord.orb}° from exact. ${ASPECT_RIFFS[chord.type] ?? ''} ${chord.detail}`,
      });
    }
    return built;
  }, [example, today]);

  const explainOption = (option: PlacementOption | undefined) => {
    if (!option) return;
    setHighlight(option.highlight);
    speak(option.explain());
  };

  // Inset drag — freely across the viewport, never lost off-screen.
  const onGripPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const panel = event.currentTarget.closest('.inset-panel');
    const rect = panel ? panel.getBoundingClientRect() : null;
    dragState.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: dragOffset.x,
      baseY: dragOffset.y,
    };
    dragLimits.current = rect
      ? {
          minX: -rect.left + 8,
          maxX: window.innerWidth - rect.right - 8,
          minY: -rect.top + 8,
          maxY: window.innerHeight - rect.bottom - 8,
        }
      : { minX: -220, maxX: 220, minY: -160, maxY: 160 };
  };
  const onGripPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragState.current;
    if (!drag || event.pointerId !== drag.id) return;
    const limits = dragLimits.current;
    const clampTo = (value: number, low: number, high: number) =>
      Math.min(Math.max(value, low), high);
    setDragOffset({
      x: clampTo(drag.baseX + event.clientX - drag.startX, limits.minX, limits.maxX),
      y: clampTo(drag.baseY + event.clientY - drag.startY, limits.minY, limits.maxY),
    });
  };
  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragState.current?.id === event.pointerId) dragState.current = null;
  };

  const onResizePointerDown = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const panel = event.currentTarget.closest('.inset-panel');
    resizeState.current = {
      id: event.pointerId,
      startX: event.clientX,
      base: panel ? panel.getBoundingClientRect().width : 320,
    };
  };
  const onResizePointerMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const resize = resizeState.current;
    if (!resize || event.pointerId !== resize.id) return;
    const next = resize.base + (event.clientX - resize.startX);
    setPanelWidth(Math.min(Math.max(next, 168), Math.min(464, window.innerWidth - 48)));
  };
  const endResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (resizeState.current?.id === event.pointerId) {
      resizeState.current = null;
      setLayoutTick(tick => tick + 1);
    }
  };

  return (
    <div className="landing">
      <header className="topbar">
        <span className="wordmark">
          Natally<em>.</em>
        </span>
        <div className="topbar-cta">
          <a className="cta-primary" href="/app.html">
            Create your natal chart ↗
          </a>
          <span className="cta-sub">Sign in to explore your own calculated chart.</span>
        </div>
      </header>

      {/* The stage: the verbatim atelier fills the viewport and stays —
          one screen, nothing scrolls away. */}
      <div className="stage" aria-hidden="true">
        <AtelierScene phase="idle" motionEnabled accountUid={null} />
        <div className="stage-shade" />
      </div>

      {/* The inset wheel: draggable anywhere, resizable, callouts tethered
          outside its frame. */}
      <div className="inset-rail">
        <div
          className="inset-drag"
          style={{ transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)` }}
        >
          <div className="inset-frame" data-chart-callout-boundary data-chart-inset="true">
            <aside
              className="inset-panel"
              aria-label="Example natal chart panel"
              style={panelWidth !== null ? { width: `${panelWidth}px` } : undefined}
            >
              <button
                type="button"
                className="inset-handle"
                aria-label="Move chart. Drag anywhere; double-click to reset."
                title="Drag to move the inset. Double-click resets."
                onPointerDown={onGripPointerDown}
                onPointerMove={onGripPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onDoubleClick={() => setDragOffset({ x: 0, y: 0 })}
              >
                ⠿ Move chart
              </button>
              <span
                className="inset-resize"
                role="separator"
                aria-label="Resize the panel"
                onPointerDown={onResizePointerDown}
                onPointerMove={onResizePointerMove}
                onPointerUp={endResize}
                onPointerCancel={endResize}
              />
              <div className="inset-swap">
                {example ? (
                  <Astrolabe3D
                    chart={example}
                    isSpinning={!reducedMotion}
                    resetTrigger={0}
                    highlightedComponents={[...highlight]}
                    reducedMotion={reducedMotion}
                    motionPaused={reducedMotion}
                    visible
                    layoutKey={`atelier-${layoutTick}`}
                    onSelectPlanet={name => explainOption(options.find(option => option.id === `planet:${name}`))}
                  />
                ) : (
                  <div className="inset-loading" role="status">
                    Casting the example wheel…
                  </div>
                )}
                <p className="inset-tag">Aurelia · 8 Nov 1997 · Toronto</p>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Explore a placement — her core reading loop over the example. */}
      <div className="explore-bar">
        <div className="copy-panel">
          <p className="example-caption">{EXAMPLE_CAPTION}</p>
          <label className="explore-label">
            Explore a placement
            <select
              value={selected}
              onChange={event => {
                setSelected(event.currentTarget.value);
                explainOption(options.find(option => option.id === event.currentTarget.value));
              }}
            >
              <option value="">Choose a planet, sign, house or aspect…</option>
              {(['Planets', 'Signs', 'Houses', 'Aspects'] as const).map(group => (
                <optgroup key={group} label={group}>
                  {options
                    .filter(option => option.group === group)
                    .map(option => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
      </div>

      <KaraokeCaption />

      <p className="landing-voice-note" role="note">
        {voiceState.admitted
          ? voiceState.speaking
            ? 'Natally is reading.'
            : 'Voice is on — pick a placement and she follows.'
          : 'Tap or type once and Natally will read aloud.'}
        {voiceState.error ? ` ${voiceState.error}` : ''}
      </p>

      <VersionBadge />
    </div>
  );
}
