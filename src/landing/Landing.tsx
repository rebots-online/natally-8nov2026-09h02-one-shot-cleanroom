// The landing surface: hero, example chart, how-it-works, offers, footer.
// All copy is authored here; prices mirror the configured billing offers
// (credit packs US$5/10/25, souvenir US$30) and credits display through the
// shared Cr formatter at the configured display rate.

import { useState } from 'react';
import { AstroChart } from '../chart/AstroChart';
import { getLesson } from '../content/lessons';
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
  aspects: [{ a: 'Sun', b: 'Mercury', kind: 'conjunction', orb: 6 }],
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

/** The lesson excerpts shown beside the example wheel. */
const EXAMPLE_LESSONS: readonly ChartBodyKey[] = ['Sun', 'Moon', 'Ascendant'];

const CREDIT_PACKS: readonly { usd: number; line: string }[] = [
  {
    usd: 5,
    line: 'A first reading — the whole wheel walked, and your opening questions properly answered.',
  },
  {
    usd: 10,
    line: 'Room to go deeper — timing, transits, and the follow-ups that actually matter.',
  },
  {
    usd: 25,
    line: 'The whole sky — a standing conversation whenever a season turns.',
  },
];

const SOUVENIR_USD = 30;

export default function Landing() {
  const [hovered, setHovered] = useState<ChartBodyKey | null>(null);
  const hoveredBody = hovered
    ? EXAMPLE_CHART.bodies.find((body) => body.key === hovered)
    : undefined;
  const perUsd = creditDisplayPerUsd();

  return (
    <div className="landing">
      <header className="topbar">
        <span className="wordmark">
          Natally<em>.</em>
        </span>
        <a className="enter" href="/app.html">
          Open the atelier →
        </a>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
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
                Open Natally
              </a>
              <a className="cta-secondary" href="#example">
                See an example chart
              </a>
            </div>
          </div>
          <div className="hero-mascot">
            <img
              src="/natally-mascot.webp"
              alt="Natally, a small brass fortune-teller automaton in a starry turban"
              width={400}
              height={400}
            />
          </div>
        </div>
      </section>

      <section className="section" id="example">
        <p className="eyebrow">Example chart</p>
        <h2>A chart, read like a map</h2>
        <p className="lede">
          Here is an example wheel — a summer-evening sky over Paris — carrying
          the placements a first reading usually opens with. Run your pointer
          over it, and meet it through a few lines from Natally&rsquo;s own
          lessons.
        </p>
        <div className="example-grid">
          <div>
            <div className="chart-stage">
              <AstroChart chart={EXAMPLE_CHART} onHoverBody={setHovered} />
            </div>
            <p className="chart-caption">
              {hoveredBody ? (
                <>
                  <strong>{getLesson(hoveredBody.key).title}</strong> —{' '}
                  {hoveredBody.sign}, {ORDINALS[hoveredBody.house - 1]} house
                </>
              ) : (
                'Sun in Leo, Moon in Pisces, Sagittarius rising.'
              )}
            </p>
          </div>
          <div className="lessons">
            {EXAMPLE_LESSONS.map((key) => {
              const lesson = getLesson(key);
              return (
                <article className="lesson-card" key={key}>
                  <h3>{lesson.title}</h3>
                  <p>{lesson.what}</p>
                  <p className="question">{lesson.question}</p>
                </article>
              );
            })}
          </div>
        </div>
        <p className="example-note">
          Example wheel for illustration. Yours is computed from your birth data
          alone, on your own device, with the Swiss Ephemeris — and read with
          you, never at you.
        </p>
      </section>

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
          {CREDIT_PACKS.map((pack) => (
            <article className="offer" key={pack.usd}>
              <p className="offer-price">${pack.usd}</p>
              <p className="offer-unit">
                {formatCr(pack.usd * 1_000_000, perUsd)} of conversation
              </p>
              <p>{pack.line}</p>
              <a href="/app.html">Open Natally →</a>
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
            Natally<em>.</em>
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
    </div>
  );
}
