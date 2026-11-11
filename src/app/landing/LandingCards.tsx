// Landing copy cards (DOCS/ARCHITECTURE.md §12.1 items 3–5, §16 pending
// LANDING rows). Every piece of the signed-out page's landing copy is
// paginated onto short cards on the app's dark-purple .card surface
// (app-shell.css tokens), scrolling by over the atelier scene behind them.
// As a section becomes the one in view — by scrolling or by an anchor
// jump, in either direction — its id and chart flag are reported through
// onSection, so the shell can swap the stage to the natal chart for the
// chart sections and back to the atelier outside them. The one Sign In
// call-to-action in this tree lives on the first card of meet-natally
// (§12.1 item 2: one click, one sign-in; no second-click prompts).

import { useEffect, useRef, useState } from 'react';
import './landing.css';

export type LandingCardsProps = {
 onSection: (id: string, chart: boolean) => void;
 onSignIn: () => void;
 signingIn: boolean;
};

/** The landing's sections and their paginated cards, authored per
 *  DOCS/RUBRIC-landing-conversion-2026-11-10.md (checkpoints 2–4 and 7):
 *  her sincere-astrologer register — warm, plain, no miracles — with the
 *  prices exact and no testimonials, countdowns, scarcity or disclaimers.
 *  `chart` is true only for the two sections whose content is the natal
 *  chart: while one of them is the section in view, the stage shows the
 *  chart (§12.1 items 4–5). */
export const LANDING_SECTIONS: readonly {
 id:
  | 'meet-natally'
  | 'your-chart'
  | 'reading-aloud'
  | 'talk-with-natally'
  | 'prices'
  | 'education';
 menuLabel: string;
 chart: boolean;
 cards: readonly { heading?: string; body: string }[];
}[] = [
 {
  id: 'meet-natally',
  menuLabel: 'Meet Natally',
  chart: false,
  cards: [
   {
    heading:
     'An astrologer who reads your natal chart aloud and shows you every part of it.',
    body: 'I’m Natally. I keep an atelier for charts. Sit down with me and I’ll cast yours, then talk it over with you — speaking as I go, with your wheel in view the whole time.',
   },
   {
    heading: 'What happens here',
    body: 'You give me your birth date, time and place. I cast your natal chart — the sky at the moment you were born — and we look at it together. When I mention your Mars or your seventh house, you can see exactly where it sits.',
   },
   {
    heading: 'Open from your first visit',
    body: 'Casting your chart is free, and the atelier keeps it for your next visit. What anything further costs is written further down this page, plainly.',
   },
  ],
 },
 {
  id: 'your-chart',
  menuLabel: 'Your chart',
  chart: true,
  cards: [
   {
    heading: 'Your chart, cast for you alone',
    body: 'A natal chart is a map of the sky at the moment you were born — where each planet stood, and against which sign. I cast yours from your birth date, time and place, and it never changes: it is the one sky that was yours.',
   },
   {
    heading: 'Every part of it, shown',
    body: 'Planets, signs, houses, the lines between them — all of it is drawn on your wheel. When I speak of your Mars or your seventh house, I show you where it sits. You never have to take my word for what is there.',
   },
   {
    heading: 'Kept for you',
    body: 'Your chart stays in the atelier, so coming back never means starting over. And when you want something to hold on to, I write up a keepsake natal report — more on that under Prices.',
   },
  ],
 },
 {
  id: 'reading-aloud',
  menuLabel: 'Your chart, explained aloud',
  chart: true,
  cards: [
   {
    heading: 'I read it aloud',
    body: 'Reading a chart alone is slow work. So I speak. As I talk through yours, my words follow the wheel — the part I am describing comes forward, and the rest waits its turn.',
   },
   {
    heading: 'Watch while you listen',
    body: 'This is not a voice bolted onto a picture. When I say “your Moon in the fourth house”, the wheel shows you your Moon in the fourth house. Ask me to go back, and we go back; ask what something means, and I tell you plainly.',
   },
   {
    heading: 'At your pace',
    body: 'Sit and let me read the whole chart, or stop me anywhere. The reading is yours, to take in whatever order suits you.',
   },
  ],
 },
 {
  id: 'talk-with-natally',
  menuLabel: 'Personal readings',
  chart: false,
  cards: [
   {
    heading: 'Talk with me',
    body: 'A reading here is a conversation. Bring what is on your mind — work, love, timing, a decision you keep circling — and I answer from your chart, showing you the part I am reading from.',
   },
   {
    heading: 'Straight answers',
    body: 'I won’t soften what your chart says, and I won’t dress it up either. If a placement is complicated, I say so and show you why. If your chart doesn’t speak to something, I’ll tell you that too.',
   },
   {
    heading: 'Come back any time',
    body: 'The atelier keeps your chart and our conversation. Come back tomorrow with a new question, and we pick up where we left off.',
   },
  ],
 },
 {
  id: 'prices',
  menuLabel: 'Prices',
  chart: false,
  cards: [
   {
    heading: 'What things cost',
    body: 'Casting your natal chart is free — no trial, no lock-in; the chart is yours. Beyond that, you pay for conversation, and only when you choose to.',
   },
   {
    heading: 'Conversation credits',
    body: 'Talking with me runs on credits, bought as packs of US$5, US$10 or US$25. Buy what you need when you need it; nothing renews on its own.',
   },
   {
    heading: 'Keepsake natal report — US$30',
    body: 'For US$30 I write your full natal report: every planet, sign and house in your chart, in my own words. You receive it as a PDF to keep, and as an interactive viewer that stays in the atelier.',
   },
  ],
 },
 {
  id: 'education',
  menuLabel: 'Learn astrology',
  chart: false,
  cards: [
   {
    heading: 'Learn as we go',
    body: 'You don’t need to know astrology to be read to, but you are welcome to learn. Beside our conversation I keep a small notebook — a short note on whatever the sky is teaching us.',
   },
   {
    heading: 'The notebook grows with you',
    body: 'Each lesson stands on its own: what a house is, why the Moon moves fast and Saturn doesn’t, what an aspect does. Read them in order, or just the one you need for the question at hand.',
   },
   {
    heading: 'No gatekeeping',
    body: 'Astrology has enough jargon for three trades. Anything I use, I explain — in the reading, in the notebook, whenever you ask.',
   },
  ],
 },
];

export function LandingCards({ onSection, onSignIn, signingIn }: LandingCardsProps) {
 const rootRef = useRef<HTMLDivElement | null>(null);
 const lastReportedRef = useRef<string | null>(null);
 const [activeIndex, setActiveIndex] = useState(0);

 // Section tracking: the section with the greatest height inside the
 // viewport is the one in view. Recomputed on scroll, resize and
 // intersection changes, so an anchor jump reaches the same answer a
 // scroll does, and leaving a section reports the one it yields to, in
 // either direction. Nothing is reported while every section is out of
 // view (the first viewport belongs to the atelier, not to a section).
 useEffect(() => {
  const root = rootRef.current;
  if (root === null) return;
  const sections = Array.from(root.querySelectorAll<HTMLElement>('section[id]'));
  const report = () => {
   const viewportHeight = window.innerHeight;
   const stage = document.querySelector('.landing-chart-stage');
   const visibleTop = window.matchMedia('(max-width: 760px)').matches
    ? stage?.getBoundingClientRect().bottom ?? 0
    : 0;
   let bestId: string | null = null;
   let bestVisible = 0;
   for (const section of sections) {
    const rect = section.getBoundingClientRect();
    const visible = Math.max(
     0,
     Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, visibleTop),
    );
    if (visible > bestVisible) {
     bestVisible = visible;
     bestId = section.id;
    }
   }
   if (bestId === null) return;
   const index = LANDING_SECTIONS.findIndex(entry => entry.id === bestId);
   const active = LANDING_SECTIONS[index];
   if (active === undefined) return;
   setActiveIndex(index);
   if (bestId === lastReportedRef.current) return;
   lastReportedRef.current = active.id;
   onSection(active.id, active.chart);
  };
  const observer = new IntersectionObserver(report);
  for (const section of sections) observer.observe(section);
  window.addEventListener('scroll', report, { passive: true });
  window.addEventListener('resize', report);
  report();
  return () => {
   observer.disconnect();
   window.removeEventListener('scroll', report);
   window.removeEventListener('resize', report);
  };
 }, [onSection]);

 const goToSection = (index: number) => {
  const section = LANDING_SECTIONS[index];
  if (section === undefined) return;
  document.getElementById(section.id)?.scrollIntoView({
   block: 'start',
   behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
 };

 return (
  <div className="landing-cards" ref={rootRef}>
   <nav className="landing-scroll-cue" aria-label="Explore the landing page">
    {activeIndex > 0 && (
     <button type="button" onClick={() => goToSection(activeIndex - 1)}>
      {activeIndex === LANDING_SECTIONS.length - 1 ? '↑ Back up' : '↑ Previous'}
     </button>
    )}
    {activeIndex < LANDING_SECTIONS.length - 1 && (
     <button type="button" onClick={() => goToSection(activeIndex + 1)}>
      {activeIndex === 0 ? 'Scroll down ↓' : 'Next ↓'}
     </button>
    )}
   </nav>
   {LANDING_SECTIONS.map(section => (
    <section key={section.id} id={section.id}>
     {section.cards.map((card, cardIndex) => {
      const hero = section.id === 'meet-natally' && cardIndex === 0;
      return (
       <article className="landing-card card" key={cardIndex}>
        {card.heading !== undefined &&
         (hero ? <h1>{card.heading}</h1> : <h2>{card.heading}</h2>)}
        <p>{card.body}</p>
        {hero && (
         <>
          <button
           type="button"
           className="btn primary wide"
           disabled={signingIn}
           onClick={onSignIn}
          >
           {signingIn ? 'Signing in…' : "Create your natal chart — it's free"}
          </button>
          <p className="landing-card-aside">Free — sign in with Google.</p>
         </>
        )}
       </article>
      );
     })}
    </section>
   ))}
  </div>
 );
}
