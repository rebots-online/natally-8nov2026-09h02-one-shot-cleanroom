// Frozen Stitch S09 retained report. All facts and sections come from the
// signed-in account's existing local record; no prototype fixture is copied.
import { useEffect, useState } from 'react';
import { authUnavailable, onAuthChange } from '../platform/firebase';
import { AstroChart } from '../chart/AstroChart';
import { downloadPdf } from './pdf';
import { loadSouvenir, type RetainedSouvenir } from './retain';

export function SouvenirViewer() {
  const [keepsake, setKeepsake] = useState<RetainedSouvenir | null>(null);

  useEffect(() => {
    if (authUnavailable) return;
    return onAuthChange(user => {
      setKeepsake(user ? loadSouvenir(user.uid) : null);
    });
  }, []);

  if (!keepsake) return null;
  const { report, chart } = keepsake;
  const cover = report.sections[0];

  return (
    <section className="atelier-report" data-bind="report">
      <header className="atelier-report-head">
        <h2 data-bind="report-title">{report.title}</h2>
      </header>
      {cover && (
        <section className="atelier-report-cover">
          <h3>{cover.heading}</h3>
          <dl className="atelier-report-facts" data-bind="report-birth-facts">
            {cover.body.split('\n').map((line, index) => {
              const colon = line.indexOf(':');
              return (
                <div className="atelier-report-fact" key={index}>
                  <dt className={colon < 0 ? 'atelier-sr-only' : undefined}>{colon >= 0 ? line.slice(0, colon) : 'Prepared'}</dt>
                  <dd>{colon >= 0 ? line.slice(colon + 1).trimStart() : line}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}
      <div className="atelier-report-chart" data-bind="report-chart">
        <AstroChart chart={chart} />
      </div>
      <div className="atelier-report-sections">
        {report.sections.slice(1).map(section => (
          <article className="atelier-report-section" key={section.heading}>
            <h3 data-bind="section-heading">{section.heading}</h3>
            <div data-bind="section-body">
              {section.body.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
          </article>
        ))}
      </div>
      <div className="atelier-report-actions">
        <button type="button" className="atelier-btn-primary" onClick={() => downloadPdf(report)}>Download PDF</button>
      </div>
    </section>
  );
}
