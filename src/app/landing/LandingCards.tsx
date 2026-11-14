// Exact S01 rail templates from the frozen Stitch master (ARCHITECTURE §24).
import { AtelierRail } from '../prototype/ImmersiveLayout';
import './landing.css';

export type LandingCardsProps = {
  onSection: (id: string, chart: boolean) => void;
  onSignIn: () => void;
  signingIn: boolean;
  sectionId?: string | null;
  onClose?: () => void;
};

export const LANDING_SECTIONS: readonly {
  id: 'meet-natally' | 'your-chart' | 'reading-aloud' | 'talk-with-natally' | 'prices' | 'education';
  menuLabel: string;
  chart: boolean;
  cards: readonly { heading?: string; body: string }[];
}[] = [
  { id: 'meet-natally', menuLabel: 'Meet Natally', chart: false,
    cards: [{ heading: 'Meet Natally', body: 'Sit with me and explore the wheel.' }] },
  { id: 'your-chart', menuLabel: 'Your chart', chart: true,
    cards: [{ heading: 'Your chart', body: 'This demonstration uses an example sky. Your chart is calculated from your birth details.' }] },
  { id: 'reading-aloud', menuLabel: 'Reading aloud', chart: true,
    cards: [{ heading: 'Reading aloud', body: 'Tap a chart detail to hear its explanation and see it highlighted.' }] },
  { id: 'talk-with-natally', menuLabel: 'Personal readings', chart: false,
    cards: [{ heading: 'Personal readings', body: 'Ask about your chart. Conversation uses credits when you choose to buy them.' }] },
  { id: 'prices', menuLabel: 'Prices', chart: false,
    cards: [{ heading: 'Prices', body: 'Your chart is free. Conversation packs: US$5, US$10 or US$25. Keepsake: US$30.' }] },
  { id: 'education', menuLabel: 'Learn astrology', chart: false,
    cards: [{ heading: 'Learn astrology', body: 'Select a planet, sign, house or aspect to hear what it means.' }] },
];

export function LandingCards({ onSection, onSignIn, signingIn, sectionId = null, onClose }: LandingCardsProps) {
  const index = LANDING_SECTIONS.findIndex(section => section.id === sectionId);
  const section = LANDING_SECTIONS[index];
  if (!section) {
    return (
      <AtelierRail title="Your birth chart">
        <p className="atelier-body-text">Tell me when and where you were born.</p>
        <button type="button" className="atelier-btn-primary" disabled={signingIn} onClick={onSignIn}>
          {signingIn ? 'Signing you in…' : 'Cast my chart'}
        </button>
        <p className="atelier-cost-line">Free · No card needed</p>
      </AtelierRail>
    );
  }
  return (
    <AtelierRail title={section.cards[0].heading ?? section.menuLabel} onClose={onClose}>
      <p className="atelier-body-text">{section.cards[0].body}</p>
      <nav className="atelier-section-directions" aria-label="Information sections">
        {index > 0 ? (
          <button type="button" className="atelier-btn-secondary" onClick={() => {
            const previous = LANDING_SECTIONS[index - 1];
            onSection(previous.id, previous.chart);
          }}>Previous</button>
        ) : <span />}
        {index < LANDING_SECTIONS.length - 1 && (
          <button type="button" className="atelier-btn-secondary" onClick={() => {
            const next = LANDING_SECTIONS[index + 1];
            onSection(next.id, next.chart);
          }}>Next</button>
        )}
      </nav>
    </AtelierRail>
  );
}
