// The dockable, resizable chart inset (DOCS/ARCHITECTURE.md §Chart inset —
// clean-room, written from the architecture words only). The unfocused pane
// floats over the stage from first load, docked bottom-right clear of
// Natally's face; it can be dragged anywhere across the full stage and docks
// to the nearest edge or corner on release; a visible corner grip resizes it
// between 20% and 60% of the stage width keeping its aspect; arrow keys move
// it and Alt+arrow keys resize it; position and size persist per account in
// localStorage. When the chart is focused (`focused`) the same pane fills the
// stage's visual area instead and Natally becomes the floating pane.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import './inset.css';

/** Inset width as a fraction of stage width: the architecture's 20–60%. */
export const INSET_MIN_W = 0.2;
export const INSET_MAX_W = 0.6;
/** Height = width × aspect; the wheel is square. */
const ASPECT = 1;
/** Default dock: bottom-right, this fraction of the stage wide. */
const DEFAULT_W = 0.34;
/** Breathing room between a docked inset and the stage edge, in px. */
const DOCK_MARGIN = 12;
/** How close to an edge (fraction of that axis) a release must land to dock. */
const DOCK_REACH = 0.24;
/** Keyboard nudge as a fraction of stage width; Alt nudge resizes. */
const KEY_STEP = 0.012;
const KEY_RESIZE_STEP = 0.02;

interface InsetGeometry {
  /** Left edge as a fraction of stage width. */
  x: number;
  /** Top edge as a fraction of stage height. */
  y: number;
  /** Width as a fraction of stage width (height keeps the aspect). */
  w: number;
}

export interface InsetProps {
  /** Full localStorage key; the caller scopes it per account or guest. */
  storageKey: string;
  /** Accessible name of the floating pane. */
  label: string;
  /** Pane content — the chart renderer (and its loading state). */
  children: ReactNode;
  /** True while the chart is focused: fill the stage visual, no chrome. */
  focused?: boolean;
  /** Fill height in px (the stage visual area) while `focused`. */
  fillHeight?: number | null;
  /** Targets she is highlighting right now, shown on the inset's bar. */
  targets?: readonly string[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Read and validate the stored geometry; null when absent or corrupt. */
function loadGeometry(storageKey: string): InsetGeometry | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as Record<string, unknown>;
    if (!isFiniteNumber(candidate.x) || !isFiniteNumber(candidate.y) || !isFiniteNumber(candidate.w)) {
      return null;
    }
    return { x: candidate.x, y: candidate.y, w: candidate.w };
  } catch {
    return null;
  }
}

function storeGeometry(storageKey: string, geometry: InsetGeometry): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(geometry));
  } catch {
    // Storage unavailable (private mode/quota): the inset lives in memory.
  }
}

interface StageBox {
  width: number;
  height: number;
}

/** Clamp geometry fractions into the stage for the current box. */
function clampGeometry(geometry: InsetGeometry, stage: StageBox): InsetGeometry {
  const wMax = Math.min(INSET_MAX_W, (0.9 * stage.height) / ASPECT / stage.width);
  const w = Math.min(Math.max(geometry.w, INSET_MIN_W), Math.max(wMax, INSET_MIN_W));
  const heightFraction = (w * stage.width * ASPECT) / stage.height;
  const x = Math.min(Math.max(geometry.x, 0), Math.max(0, 1 - w));
  const y = Math.min(Math.max(geometry.y, 0), Math.max(0, 1 - heightFraction));
  return { x, y, w };
}

/**
 * The floating chart inset. Positions itself inside its parent element
 * (`.stage-inset-layer`, which fills the stage); measures that parent via
 * ResizeObserver so window resizes re-clamp the pane into the stage.
 */
export function Inset({
  storageKey,
  label,
  children,
  focused = false,
  fillHeight = null,
  targets = [],
}: InsetProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<StageBox | null>(null);
  const [geometry, setGeometry] = useState<InsetGeometry | null>(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);

  // Measure the host layer (this element's parent, which fills the stage).
  useLayoutEffect(() => {
    const host = rootRef.current?.parentElement;
    if (host === null || host === undefined) return;
    const observer = new ResizeObserver(entries => {
      const box = entries[entries.length - 1];
      if (box !== undefined) {
        const { width, height } = box.contentRect;
        if (width > 0 && height > 0) setStage({ width, height });
      }
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  // First metrics: restore the persisted geometry or dock bottom-right.
  useEffect(() => {
    if (stage === null || geometry !== null) return;
    const stored = loadGeometry(storageKey);
    const base =
      stored ?? {
        x: 1,
        y: 1,
        w: DEFAULT_W,
      };
    const clamped = clampGeometry(
      stored === null
        ? {
            x: 1 - base.w - DOCK_MARGIN / stage.width,
            y: 1 - (base.w * stage.width * ASPECT) / stage.height - DOCK_MARGIN / stage.height,
            w: base.w,
          }
        : base,
      stage,
    );
    setGeometry(clamped);
  }, [stage, geometry, storageKey]);

  // Keep the pane inside the stage when the stage resizes.
  useEffect(() => {
    if (stage === null || geometry === null) return;
    const clamped = clampGeometry(geometry, stage);
    if (clamped !== geometry && (clamped.x !== geometry.x || clamped.y !== geometry.y || clamped.w !== geometry.w)) {
      setGeometry(clamped);
    }
  }, [stage, geometry]);

  const persist = useCallback(
    (next: InsetGeometry) => {
      storeGeometry(storageKey, next);
    },
    [storageKey],
  );

  /** Live pointer positions during a drag/resize, in stage pixels. */
  const dragRef = useRef<{ grabX: number; grabY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);

  const pointInStage = (event: ReactPointerEvent<HTMLElement>): { x: number; y: number } => {
    const host = rootRef.current?.parentElement;
    const rect = host?.getBoundingClientRect();
    const x = rect === undefined ? event.clientX : event.clientX - rect.left;
    const y = rect === undefined ? event.clientY : event.clientY - rect.top;
    return { x, y };
  };

  /** Drag the pane by its bar; dock to the nearest edge/corner on release. */
  const onBarPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || stage === null || geometry === null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointInStage(event);
    dragRef.current = {
      grabX: point.x - geometry.x * stage.width,
      grabY: point.y - geometry.y * stage.height,
    };
    setDragging(true);
  };

  const onBarPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || stage === null || geometry === null || dragRef.current === null) return;
    const point = pointInStage(event);
    const width = geometry.w * stage.width;
    const height = width * ASPECT;
    const x = Math.min(Math.max(point.x - dragRef.current.grabX, 0), Math.max(0, stage.width - width));
    const y = Math.min(Math.max(point.y - dragRef.current.grabY, 0), Math.max(0, stage.height - height));
    setGeometry({ ...geometry, x: x / stage.width, y: y / stage.height });
  };

  const onBarPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || stage === null || geometry === null) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragging(false);

    const width = geometry.w * stage.width;
    const height = width * ASPECT;
    const centerX = geometry.x * stage.width + width / 2;
    const centerY = geometry.y * stage.height + height / 2;
    const nearLeft = centerX < DOCK_REACH * stage.width;
    const nearRight = centerX > (1 - DOCK_REACH) * stage.width;
    const nearTop = centerY < DOCK_REACH * stage.height;
    const nearBottom = centerY > (1 - DOCK_REACH) * stage.height;

    let x = geometry.x * stage.width;
    let y = geometry.y * stage.height;
    if (nearLeft || nearRight || nearTop || nearBottom) {
      if (nearLeft) x = DOCK_MARGIN;
      if (nearRight) x = stage.width - width - DOCK_MARGIN;
      if (nearTop) y = DOCK_MARGIN;
      if (nearBottom) y = stage.height - height - DOCK_MARGIN;
    }
    const next = clampGeometry(
      { x: x / stage.width, y: y / stage.height, w: geometry.w },
      stage,
    );
    setGeometry(next);
    persist(next);
  };

  /** Resize from the corner grip, keeping the aspect and the 20–60% span. */
  const onGripPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || stage === null || geometry === null) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointInStage(event);
    resizeRef.current = { startX: point.x, startW: geometry.w * stage.width };
    setResizing(true);
  };

  const onGripPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizing || stage === null || geometry === null || resizeRef.current === null) return;
    const point = pointInStage(event);
    const delta = point.x - resizeRef.current.startX;
    const wMax = Math.min(INSET_MAX_W, (0.9 * stage.height) / ASPECT / stage.width);
    const width = Math.min(
      Math.max(resizeRef.current.startW + delta, INSET_MIN_W * stage.width),
      Math.max(wMax, INSET_MIN_W) * stage.width,
    );
    setGeometry(clampGeometry({ ...geometry, w: width / stage.width }, stage));
  };

  const onGripPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizing || geometry === null) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    resizeRef.current = null;
    setResizing(false);
    persist(geometry);
  };

  /** Arrow keys move the pane; Alt+arrow keys resize it. */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!event.key.startsWith('Arrow') || stage === null || geometry === null) return;
    event.preventDefault();
    const width = geometry.w * stage.width;
    const height = width * ASPECT;
    const step = Math.max(KEY_STEP * stage.width, 4);
    let x = geometry.x * stage.width;
    let y = geometry.y * stage.height;
    let w = width;
    if (event.altKey) {
      const grow = (event.key === 'ArrowRight' || event.key === 'ArrowDown') ? 1 : -1;
      const wMax = Math.min(INSET_MAX_W, (0.9 * stage.height) / ASPECT / stage.width);
      w = Math.min(Math.max(width + grow * KEY_RESIZE_STEP * stage.width, INSET_MIN_W * stage.width), Math.max(wMax, INSET_MIN_W) * stage.width);
    } else if (event.key === 'ArrowLeft') x -= step;
    else if (event.key === 'ArrowRight') x += step;
    else if (event.key === 'ArrowUp') y -= step;
    else if (event.key === 'ArrowDown') y += step;
    const next = clampGeometry({ x: x / stage.width, y: y / stage.height, w: w / stage.width }, stage);
    setGeometry(next);
    persist(next);
  };

  if (focused) {
    return (
      <div
        className="chart-inset-fill"
        style={fillHeight !== null && fillHeight > 0 ? { height: fillHeight } : undefined}
      >
        <div className="chart-inset__content">{children}</div>
      </div>
    );
  }

  if (stage === null || geometry === null) {
    // Awaiting first stage metrics: reserve the default footprint invisibly.
    return (
      <div ref={rootRef} className="chart-inset" style={{ visibility: 'hidden' }} aria-hidden="true">
        <div className="chart-inset__content" />
      </div>
    );
  }

  const width = geometry.w * stage.width;
  const height = width * ASPECT;

  return (
    <div
      ref={rootRef}
      className="chart-inset"
      role="region"
      aria-label={`${label} — drag to move, arrow keys to move, Alt and arrow keys to resize`}
      tabIndex={0}
      data-dragging={dragging || resizing}
      style={{
        left: geometry.x * stage.width,
        top: geometry.y * stage.height,
        width,
        height,
        visibility: stage === null ? 'hidden' : undefined,
      }}
      onKeyDown={onKeyDown}
    >
      <div
        className="chart-inset__bar"
        onPointerDown={onBarPointerDown}
        onPointerMove={onBarPointerMove}
        onPointerUp={onBarPointerUp}
        onPointerCancel={onBarPointerUp}
      >
        <span className="chart-inset__gripdots" aria-hidden="true" />
        <span className="chart-inset__label">{label}</span>
        {targets.length > 0 && (
          <span className="chart-inset__targets">
            {targets.slice(0, 4).map(target => (
              <span key={target} className="chart-inset__target">
                {target}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="chart-inset__content">{children}</div>
      <div
        className="chart-inset__resizer"
        aria-hidden="true"
        onPointerDown={onGripPointerDown}
        onPointerMove={onGripPointerMove}
        onPointerUp={onGripPointerUp}
        onPointerCancel={onGripPointerUp}
      />
    </div>
  );
}
