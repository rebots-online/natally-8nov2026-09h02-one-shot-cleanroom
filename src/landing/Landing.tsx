// The landing surface: full-bleed atelier hero, sticky inset panel that
// carries the animated cut-out mascot and then swaps to the focused example
// chart while the explanation beats scroll, offers at the configured prices,
// and the footer. Prices mirror the configured billing offers (credit packs
// US$5/10/25, souvenir US$30); credits display through the shared Cr
// formatter at the configured display rate.

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { AtelierScene } from '../atelier-original/components/atelier/AtelierScene';
import { Astrolabe3D } from '../atelier-original/components/Astrolabe3D';
import VersionBadge from '../app/VersionBadge';
import { computeAstrolabeChart, type NatalChartResult } from '../chart/astrolabeInput';
import { formatCr } from '../shared/credits';
import { creditDisplayPerUsd } from '../platform/env';
import type { ChartBodyKey, NatalChart } from '../shared/types';

/** The example wheel shown on the landing: a sample summer-evening sky. */
const EXAMPLE_CHART: NatalChart = {
 input: {
  dateIso: '1990-08-10',
  timeIso: '21:40',
  place: {
   label: 'Paris, France',
   latitude: 48.8566,
   longitude: 2.3522,
   timezoneIana: 'Europe/Paris',
  },
 },
 bodies: [
  {
   key: 'Sun',
   position: { longitude: 137.4, latitude: 0, speed: 0.96 },
   sign: 'Leo',
   house: 5,
  },
  {
   key: 'Moon',
   position: { longitude: 341.2, latitude: -3.1, speed: 12.9 },
   sign: 'Pisces',
   house: 8,
  },
  {
   key: 'Mercury',
   position: { longitude: 131.4, latitude: 1.2, speed: 1.45 },
   sign: 'Leo',
   house: 5,
  },
  {
   key: 'Venus',
   position: { longitude: 120.5, latitude: 0.6, speed: 1.1 },
   sign: 'Leo',
   house: 8,
  },
  {
   key: 'Mars',
   position: { longitude: 205.0, latitude: -0.4, speed: 0.66 },
   sign: 'Libra',
   house: 11,
  },
  {
   key: 'Jupiter',
   position: { longitude: 355.0, latitude: 0.9, speed: 0.2 },
   sign: 'Pisces',
   house: 4,
  },
  {
   key: 'Saturn',
   position: { longitude: 285.0, latitude: 1.4, speed: 0.12 },
   sign: 'Capricorn',
   house: 2,
  },
  {
   key: 'Ascendant',
   position: { longitude: 252.9 },
   sign: 'Sagittarius',
   house: 1,
  },
  {
   key: 'Midheaven',
   position: { longitude: 162.9 },
   sign: 'Virgo',
   house: 10,
  },
 ],
 houses: [
  { house: 1, position: { longitude: 252.9 } },
  { house: 2, position: { longitude: 282.9 } },
  { house: 3, position: { longitude: 312.9 } },
  { house: 4, position: { longitude: 342.9 } },
  { house: 5, position: { longitude: 12.9 } },
  { house: 6, position: { longitude: 42.9 } },
  { house: 7, position: { longitude: 72.9 } },
  { house: 8, position: { longitude: 102.9 } },
  { house: 9, position: { longitude: 132.9 } },
  { house: 10, position: { longitude: 162.9 } },
  { house: 11, position: { longitude: 192.9 } },
  { house: 12, position: { longitude: 222.9 } },
 ],
 ascendant: { longitude: 252.9 },
 midheaven: { longitude: 162.9 },
 aspects: [
  { a: 'Sun', b: 'Mercury', kind: 'conjunction', orb: 6 },
  { a: 'Sun', b: 'Ascendant', kind: 'trine', orb: 4.5 },
  { a: 'Moon', b: 'Ascendant', kind: 'square', orb: 1.7 },
  { a: 'Venus', b: 'Mars', kind: 'square', orb: 5.5 },
  { a: 'Venus', b: 'Jupiter', kind: 'trine', orb: 5.5 },
 ],
};

const ORDINALS = [
 '1st',
 '2nd',
 '3rd',
 '4th',
 '5th',
 '6th',
 '7th',
 '8th',
 '9th',
 '10th',
 '11th',
 '12th',
] as const;

/**
 * The explanation beats. The first three each focus one body of the example
 * chart (the sticky inset highlights it while its siblings dim); the last
 * beat pulls back to the whole, undimmed wheel.
 */
const BEATS: readonly { key: ChartBodyKey | null; heading: string; body: string }[] = [
 {
  key: 'Sun',
  heading: 'The Sun — where your light gathers',
  body: 'Vitality, pride, the thing you cannot help shining at. In this example sky the Sun sits in Leo, in the fifth house of play and performance: warmth that genuinely wants an audience.',
 },
 {
  key: 'Moon',
  heading: 'The Moon — your inner weather',
  body: 'The Moon is the tide under your day — mood, memory, what safety feels like. Here it floats in Pisces, in the eighth house: feeling that runs deep and picks up every current in the room.',
 },
 {
  key: 'Ascendant',
  heading: 'The Ascendant — the door you open',
  body: 'Not a planet but a point: the sign rising on the eastern horizon at your first breath. Sagittarius rising opens onto wonder — the doorway between you and every room you walk into.',
 },
 {
  key: null,
  heading: 'And the wheel that holds them all',
  body: 'Twelve houses, and the chords between them — conversations the planets are having with each other. Notice the structure never dims while each light takes its turn; that is exactly how Natally reads a chart. The map stays, the attention moves.',
 },
];

const CREDIT_PACKS: readonly { usd: number; line: string; cta: (cr: string) => string }[] = [
 {
  usd: 5,
  line: 'A first reading — the whole wheel walked, and your opening questions properly answered.',
  cta: cr => `Start with ${cr}`,
 },
 {
  usd: 10,
  line: 'Room to go deeper — timing, transits, and the follow-ups that actually matter.',
  cta: () => 'Keep the reading going',
 },
 {
  usd: 25,
  line: 'The whole sky — a standing conversation whenever a season turns.',
  cta: () => 'Take the whole sky',
 },
];

const SOUVENIR_USD = 30;

export default function Landing() {
 // Inset choreography: the chart panel is present from load — the first
 // impression is Natally in her room WITH the slowly rotating toroidal
 // wheel beside her (frozen design) — and the explanation beats drive its
 // focus and zoom.
 const [beat, setBeat] = useState(-1);
 // The example wheel, computed once with the original renderer's pipeline.
 const [example, setExample] = useState<NatalChartResult | null>(null);
 const [reducedMotion, setReducedMotion] = useState(
  () =>
   typeof window.matchMedia === 'function' &&
   window.matchMedia('(prefers-reduced-motion: reduce)').matches,
 );
 // Inset drag: the panel is repositionable within a clamped range.
 const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
 const dragState = useRef<{ id: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
 const beatRefs = useRef<(HTMLElement | null)[]>([]);

 useEffect(() => {
  if (typeof window.matchMedia !== 'function') return;
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const update = () => setReducedMotion(query.matches);
  query.addEventListener?.('change', update);
  return () => query.removeEventListener?.('change', update);
 }, []);

 useEffect(() => {
  let live = true;
  computeAstrolabeChart(EXAMPLE_CHART.input)
   .then(result => {
    if (live) setExample(result);
   })
   .catch(() => {
    // The inset keeps its honest loading line.
    if (live) setExample(null);
   });
  return () => {
   live = false;
  };
 }, []);


 // Beat focus: whichever explanation block crosses the reading band drives
 // the chart's activeBody; the last beat (whole wheel) restores all bodies.
 useEffect(() => {
  const observer = new IntersectionObserver(
   entries => {
    for (const entry of entries) {
     if (entry.isIntersecting) {
      setBeat(Number((entry.target as HTMLElement).dataset.beat ?? -1));
     }
    }
   },
   { rootMargin: '-42% 0px -42% 0px', threshold: 0 },
  );
  for (const element of beatRefs.current) if (element) observer.observe(element);
  return () => observer.disconnect();
 }, []);

 const activeBeat = beat >= 0 && beat < BEATS.length ? BEATS[beat] : undefined;
 const activeBody = activeBeat?.key ?? null;
 const activeBodyDetail = activeBody
  ? EXAMPLE_CHART.bodies.find(candidate => candidate.key === activeBody)
  : undefined;
 const perUsd = creditDisplayPerUsd();

 // Inset drag: pointer-grab the grip strip to reposition the panel; a
 // double-click on the grip returns it home.
 const onGripPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
  if (event.button !== 0) return;
  event.currentTarget.setPointerCapture(event.pointerId);
  dragState.current = {
   id: event.pointerId,
   startX: event.clientX,
   startY: event.clientY,
   baseX: dragOffset.x,
   baseY: dragOffset.y,
  };
 };
 const onGripPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
  const drag = dragState.current;
  if (!drag || event.pointerId !== drag.id) return;
  const clamp = (value: number, limit: number) => Math.min(Math.max(value, -limit), limit);
  setDragOffset({
   x: clamp(drag.baseX + event.clientX - drag.startX, 220),
   y: clamp(drag.baseY + event.clientY - drag.startY, 160),
  });
 };
 const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
  if (dragState.current?.id === event.pointerId) dragState.current = null;
 };

 const caption = activeBodyDetail
  ? `${activeBodyDetail.key === 'Ascendant' ? 'Ascendant' : activeBodyDetail.key} in ${activeBodyDetail.sign}, ${ORDINALS[activeBodyDetail.house - 1]} house`
  : 'Sun in Leo, Moon in Pisces, Sagittarius rising.';

 return (
  <div className="landing">
   <header className="topbar">
    <span className="wordmark">
     Natally
    </span>
    <a className="enter" href="/app.html">
     Open the atelier →
    </a>
   </header>

   <div className="hero-stage">
    {/* The persistent stage: the verbatim atelier stays pinned while the
            copy scrolls past it. Hero-scale Natally, breakable trinkets,
            armillary — the original scene, fully interactive. */}
    <div className="hero-scene" aria-hidden="true">
     <AtelierScene phase="idle" motionEnabled accountUid={null} />
     <div className="hero-scene-shade" />
    </div>

    {/* The first screen is the stage itself — Natally at hero scale in
            her interactive room, unobstructed (frozen design: copy lives
            below the stage, never over her). */}
    <section className="hero" aria-label="Natally in her atelier" />

    <section className="section meet" id="meet">
     <div className="copy-panel">
      <p className="eyebrow">A small atelier, open all hours</p>
      <h1>
       Natally — your <em>astrologer</em>, not a horoscope mill
      </h1>
      <p className="subhead">
       Tell her your birth date, time, and place. Natally computes your{' '}
       <strong>actual natal chart</strong> and then sits down with you to
       read it — placement by placement, in plain language, with no doom
       in sight. She is a companion who knows the sky, not a vending
       machine of sun-sign slogans.
      </p>
      <div className="hero-actions">
       <a className="cta-primary" href="/app.html">
        Create your natal chart ✦
       </a>
       <a className="cta-secondary" href="#example">
        Watch her read a chart
       </a>
      </div>
     </div>
    </section>

    {/* Sticky inset: the draggable example chart appears over the scene
            as the explanation begins, then zooms with each beat. */}
    <div className="inset-rail">
     <div
      className="inset-drag"
      style={{ transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)` }}
     >
      <aside
       className={`inset-panel is-shown${activeBody !== null ? ' inset-panel--zoom' : ''}`}
       aria-label="Example natal chart panel"
      >
       <div
        className="inset-grip"
        role="separator"
        aria-label="Drag to move the panel (double-click to reset)"
        onPointerDown={onGripPointerDown}
        onPointerMove={onGripPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => setDragOffset({ x: 0, y: 0 })}
       >
        <span className="inset-grip-dots" aria-hidden="true" />
       </div>
       <div className="inset-swap">
        {example ? (
         <Astrolabe3D
          chart={example}
          isSpinning={!reducedMotion}
          resetTrigger={0}
          highlightedComponents={activeBody ? [activeBody] : []}
          focusSequence={beat}
          reducedMotion={reducedMotion}
          motionPaused={reducedMotion}
          visible
          layoutKey="atelier"
         />
        ) : (
         <div className="inset-loading" role="status">
          Casting the example wheel…
         </div>
        )}
        <p className="inset-tag inset-tag--chart">{caption}</p>
       </div>
      </aside>
     </div>
    </div>

    <section className="section explain" id="example">
     <p className="eyebrow">How she reads</p>
     <h2>A chart, read like a map</h2>
     <p className="lede">
      The panel beside you carries a real wheel — a summer-evening sky over
      Paris, cast with the same Swiss Ephemeris your own chart will use.
      Drag the wheel to turn it; then watch each light take its turn as
      she walks you through.
     </p>
     <div className="explain-beats">
      {BEATS.map((entry, index) => (
       <article
        key={entry.heading}
        className={`explain-beat${beat === index ? ' is-current' : ''}`}
        data-beat={index}
        ref={element => {
         beatRefs.current[index] = element;
        }}
       >
        <span className="explain-beat-step" aria-hidden="true">
         {index + 1}
        </span>
        <h3>{entry.heading}</h3>
        <p>{entry.body}</p>
       </article>
      ))}
     </div>
     <p className="example-note">
      Example wheel for illustration. Yours is computed from your birth data
      alone, on your own device, with the Swiss Ephemeris — and read with
      you, never at you.
     </p>
    </section>
   </div>

   <section className="section" id="how-it-works">
    <p className="eyebrow">How it works</p>
    <h2>Three steps, no mystique</h2>
    <p className="lede">
     Everything happens in one place, at your pace: a chart that is really
     yours, and a conversation that follows your curiosity rather than a
     script.
    </p>
    <div className="steps">
     <article className="step">
      <span className="step-number" aria-hidden="true">
       1
      </span>
      <h3>Tell her when and where</h3>
      <p>
       Birth date, clock time if you know it — even roughly helps — and
       the town. Natally resolves the place and computes the wheel right
       there on your device.
      </p>
     </article>
     <article className="step">
      <span className="step-number" aria-hidden="true">
       2
      </span>
      <h3>Walk your wheel</h3>
      <p>
       Ascendant, Sun, Moon, the twelve houses: each placement introduced
       in plain words, one clear image at a time, the way a good teacher
       unfolds a map.
      </p>
     </article>
     <article className="step">
      <span className="step-number" aria-hidden="true">
       3
      </span>
      <h3>Talk as long as the sky interests you</h3>
      <p>
       Ask about work, love, seasons, timing. Natally reads your chart
       against your questions — by message or by voice — warm, specific,
       and never fatalistic.
      </p>
     </article>
    </div>
   </section>

   <section className="section" id="offers">
    <p className="eyebrow">Credits &amp; keepsakes</p>
    <h2>Plain prices, warm readings</h2>
    <p className="lede">
     Conversation runs on credits — a US dollar is {perUsd} of them — and
     the reading you love can be bound into a keepsake.
    </p>
    <div className="offers">
     {CREDIT_PACKS.map(pack => (
      <article className="offer" key={pack.usd}>
       <p className="offer-price">${pack.usd}</p>
       <p className="offer-unit">
        {formatCr(pack.usd * 1_000_000, perUsd)} of conversation
       </p>
       <p>{pack.line}</p>
       <a href="/app.html">{pack.cta(formatCr(pack.usd * 1_000_000, perUsd))}</a>
      </article>
     ))}
     <article className="offer souvenir">
      <p className="offer-price">${SOUVENIR_USD}</p>
      <p className="offer-unit">The souvenir report</p>
      <p>
       Your reading and your actual chart, written up and typeset into a
       keepsake PDF you can keep for years.
      </p>
      <a href="/app.html">See the souvenir →</a>
     </article>
    </div>
    <p className="offers-fineprint">
     One-time purchases, handled by Chargebee. Nothing renews itself, and
     nothing is charged inside a conversation without your say-so.
    </p>
   </section>

   <footer className="landing-footer">
    <div className="footer-inner">
     <span className="wordmark">
      Natally
     </span>
     <nav className="footer-links" aria-label="Legal">
      <a href="/privacy.html">Privacy</a>
      <a href="/terms.html">Terms</a>
     </nav>
     <p className="footer-tag">
      An astrologer companion in a small candlelit atelier — charts
      computed on your device, conversation kept warm.
     </p>
     <span className="footer-copyright">© 2026 Natally</span>
    </div>
   </footer>

   <VersionBadge />
  </div>
 );
}
