// W12 SOUVENIR — the retained keepsake viewer (DOCS/ARCHITECTURE.md §Surfaces,
// Souvenir). Reads the souvenir retained at purchase time for the signed-in
// account and re-renders its report sections with the natal chart beside the
// text. Renders nothing while signed out or before a purchase, so a shell can
// mount it unconditionally.

import { useEffect, useState } from 'react';
import { authUnavailable, onAuthChange } from '../platform/firebase';
import { AstroChart } from '../chart/AstroChart';
import { downloadPdf } from './pdf';
import { loadSouvenir, type RetainedSouvenir } from './retain';

const wrapStyle = {
  padding: '28px 0 8px',
} as const;

const headerStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
  alignItems: 'baseline',
  justifyContent: 'space-between',
  borderBottom: '1px solid var(--plum-line)',
  paddingBottom: 14,
  marginBottom: 22,
} as const;

const titleStyle = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontSize: 22,
  fontWeight: 400,
  color: 'var(--parchment)',
} as const;

const metaStyle = {
  margin: '4px 0 0',
  fontSize: 13,
  color: 'var(--parchment-muted)',
} as const;

const buttonStyle = {
  padding: '9px 18px',
  background: 'var(--brass)',
  color: 'var(--plum-deep)',
  border: 'none',
  borderRadius: 8,
  fontFamily: 'inherit',
  fontSize: 14,
  cursor: 'pointer',
} as const;

const columnsStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 28,
  alignItems: 'flex-start',
} as const;

const chartPaneStyle = {
  flex: '0 1 360px',
  minWidth: 280,
  position: 'sticky',
  top: 16,
} as const;

const textPaneStyle = {
  flex: '1 1 340px',
  minWidth: 300,
} as const;

const articleStyle = {
  maxWidth: 560,
} as const;

const headingStyle = {
  margin: '0 0 8px',
  fontFamily: 'var(--font-display)',
  fontSize: 19,
  fontWeight: 400,
  color: 'var(--brass)',
} as const;

const paragraphStyle = {
  margin: '0 0 10px',
  fontSize: 15,
  lineHeight: 1.75,
  color: 'var(--parchment)',
  whiteSpace: 'pre-line',
} as const;

export function SouvenirViewer() {
  const [keepsake, setKeepsake] = useState<RetainedSouvenir | null>(null);

  useEffect(() => {
    if (authUnavailable) return;
    return onAuthChange((user) => {
      setKeepsake(user ? loadSouvenir(user.uid) : null);
    });
  }, []);

  if (!keepsake) return null;

  const { report, chart } = keepsake;
  return (
    <section aria-labelledby="souvenir-viewer-title" style={wrapStyle}>
      <header style={headerStyle}>
        <div>
          <h2 id="souvenir-viewer-title" style={titleStyle}>
            {report.title}
          </h2>
          <p style={metaStyle}>Keepsake report, retained in your account</p>
        </div>
        <button type="button" style={buttonStyle} onClick={() => downloadPdf(report)}>
          Download PDF again
        </button>
      </header>
      <div style={columnsStyle}>
        <div style={chartPaneStyle}>
          <AstroChart chart={chart} />
        </div>
        <div style={textPaneStyle}>
          {report.sections.map((section) => (
            <article key={section.heading} style={articleStyle}>
              <h3 style={headingStyle}>{section.heading}</h3>
              {section.body.split('\n\n').map((paragraph, index) => (
                <p key={index} style={paragraphStyle}>
                  {paragraph}
                </p>
              ))}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
