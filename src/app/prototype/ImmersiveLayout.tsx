import type { ReactNode } from 'react';
import { displayVersion } from '../../platform/version';
import './atelier-frozen.css';

/** Mechanical transcription of the frozen Stitch frame. Live renderers
 * replace its image contents; each rail task supplies its own exact template. */
export interface ImmersiveLayoutProps {
  header: ReactNode;
  stage: ReactNode;
  rail: ReactNode;
  caption?: ReactNode;
  status?: ReactNode;
}

export function ImmersiveLayout({ header, stage, rail, caption, status }: ImmersiveLayoutProps) {
  return (
    <div className="atelier-viewport">
      {header}
      <main className="atelier-main-layout">
        <div className="atelier-stage-col">
          <div className="atelier-stage-box" data-slot="stage">
            {stage}
            <div className="atelier-stage-status-overlay" data-slot="status" data-bind="status">
              {status}
            </div>
          </div>
          <div
            className="atelier-caption-band"
            data-slot="caption"
            data-bind="spoken-caption"
            aria-live="polite"
          >
            {caption}
          </div>
        </div>
        <div className="atelier-rail-col" data-slot="rail">
          <div className="atelier-rail-surface" id="atelier-rail-mount">
            {rail}
          </div>
          <footer className="atelier-rail-footer">
            <div>
              <a href="/privacy.html">Privacy</a>
              <a href="/terms.html">Terms</a>
            </div>
            <span className="atelier-version-tag" data-bind="version">v{displayVersion}</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export interface AtelierRailProps {
  title: string;
  onClose?: () => void;
  onBack?: () => void;
  children: ReactNode;
  labelledBy?: string;
}

/** Templates contain a heading row and task contents, never another rail
 * surface or modal layer. Back and Close retain the exported semantics. */
export function AtelierRail({ title, onClose, onBack, children, labelledBy }: AtelierRailProps) {
  return (
    <>
      <div className="atelier-rail-header">
        <h1 className="atelier-rail-title" id={labelledBy} tabIndex={-1}>{title}</h1>
        {(onBack || onClose) && (
          <button
            type="button"
            className="atelier-rail-btn-icon"
            aria-label={onBack ? 'Back' : 'Close'}
            onClick={onBack ?? onClose}
          >
            {onBack ? '←' : '×'}
          </button>
        )}
      </div>
      {children}
    </>
  );
}
