// The dockable, resizable chart inset (DOCS/ARCHITECTURE.md §Chart inset —
// clean-room, written from the architecture words only). The unfocused pane
// floats over the stage from first load; it can be dragged anywhere across
// the full stage and docks to the nearest edge or corner on release; a
// visible corner grip resizes it between 20% and 60% of the stage width
// keeping its aspect; arrow keys move it and Alt+arrow keys resize it;
// position and size persist per account in localStorage.
//
// First-load placement serves one intent: the customer can always see both
// Natally and her chart well enough to use them — neither defeats the
// other. Measured against the on-screen box of her rendered head
// (`.atelier-character__head`): roomy stages get the largest corner/size
// (20–60%) that leaves her face clear; tight stages get the least overlap
// while the chart stays legible; when any legible inset would cover her
// face (folded-phone covers) the stage inverts — the chart takes focus and
// Natally becomes the inset, the same swap a reading uses. The placement
// re-evaluates on resize until the customer moves the pane; after that the
// customer's own choice always wins. When the chart is focused (`focused`)
// the same pane fills the stage's visual area.

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
/** Breathing room between a docked inset and the stage edge, in px. */
const DOCK_MARGIN = 12;
/** How close to an edge (fraction of that axis) a release must land to dock. */
const DOCK_REACH = 0.24;
/** Keyboard nudge as a fraction of stage width; Alt nudge resizes. */
const KEY_STEP = 0.012;
const KEY_RESIZE_STEP = 0.02;
/**
 * When even the smallest chart hides this much of her face on every corner,
 * the stage is too small for both: the chart takes focus instead.
 */
const FACE_COVERED_INVERT = 0.8;

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
  /**
   * First-load evaluation: true when the stage is too small for both panes
   * and the chart should take focus (Natally becomes the inset). Reported
   * on every change until the customer moves the pane.
   */
  onAutoInvert?: (invert: boolean) => void;
}

interface StageBox {
  width: number;
  height: number;
}

interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';
/** Deterministic tie order for the computed first-load dock. */
const CORNERS: readonly Corner[] = ['br', 'bl', 'tr', 'tl'];

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

/** Clamp geometry fractions into the stage for the current box. */
function clampGeometry(geometry: InsetGeometry, stage: StageBox): InsetGeometry {
  const wMax = Math.min(INSET_MAX_W, (0.9 * stage.height) / ASPECT / stage.width);
  const w = Math.min(Math.max(geometry.w, INSET_MIN_W), Math.max(wMax, INSET_MIN_W));
  const heightFraction = (w * stage.width * ASPECT) / stage.height;
  const x = Math.min(Math.max(geometry.x, 0), Math.max(0, 1 - w));
  const y = Math.min(Math.max(geometry.y, 0), Math.max(0, 1 - heightFraction));
  return { x, y, w };
}

/** The on-screen box of Natally's rendered head, in stage coordinates. */
function faceRectInStage(stageEl: HTMLElement | null): Rect | null {
  const head = stageEl?.querySelector('.atelier-character__head');
  if (!(head instanceof SVGElement) || stageEl === null) return null;
  const stageRect = stageEl.getBoundingClientRect();
  const box = head.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return null;
  return {
    x1: box.left - stageRect.left,
    y1: box.top - stageRect.top,
    x2: box.right - stageRect.left,
    y2: box.bottom - stageRect.top,
  };
}

function dockedRectAtCorner(corner: Corner, width: number, stage: StageBox): Rect {
  const height = width * ASPECT;
  const x1 = corner.endsWith('l') ? DOCK_MARGIN : stage.width - width - DOCK_MARGIN;
  const y1 = corner.startsWith('t') ? DOCK_MARGIN : stage.height - height - DOCK_MARGIN;
  return { x1, y1, x2: x1 + width, y2: y1 + height };
}

function intersection(a: Rect, b: Rect | null): Rect | null {
  if (b === null) return null;
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  return x2 > x1 && y2 > y1 ? { x1, y1, x2, y2 } : null;
}

function rectArea(rect: Rect | null): number {
  return rect === null ? 0 : (rect.x2 - rect.x1) * (rect.y2 - rect.y1);
}

type AutoPlacement =
  | { kind: 'dock'; geometry: InsetGeometry }
  | { kind: 'invert' };

/**
 * First-load placement from the intent: roomy → the largest corner/size in
 * 20–60% that leaves her face clear; tight → the least overlap while the
 * chart stays legible (larger size on ties); too small for both → invert.
 * Overlap with size is monotone per corner, so each corner's best sits at
 * the size breakpoints where the growing inset edges cross her face edges.
 */
function computeAutoPlacement(stage: StageBox, face: Rect | null): AutoPlacement {
  const wMin = INSET_MIN_W * stage.width;
  const wFullest = INSET_MAX_W * stage.width;
  const wCap = Math.max(
    wMin,
    Math.min(wFullest, (0.9 * stage.height) / ASPECT),
  );
  const faceArea = rectArea(face);

  // Even the smallest chart hides essentially all of her face everywhere:
  // too small for both — the chart takes focus.
  if (face !== null && faceArea > 0) {
    const leastHidden = CORNERS.reduce((best, corner) => {
      const hidden = rectArea(intersection(dockedRectAtCorner(corner, wMin, stage), face)) / faceArea;
      return Math.min(best, hidden);
    }, Number.POSITIVE_INFINITY);
    if (leastHidden > FACE_COVERED_INVERT) return { kind: 'invert' };
  }

  let best: { corner: Corner; w: number; overlap: number } | null = null;
  for (const corner of CORNERS) {
    // Widths whose growing inset edges just reach the face's near edges;
    // overlap is piecewise linear between these breakpoints.
    const candidates = new Set<number>([wMin, wCap]);
    if (face !== null) {
      if (corner.endsWith('l')) {
        candidates.add(face.x1 - DOCK_MARGIN);
      } else {
        candidates.add(stage.width - DOCK_MARGIN - face.x2);
      }
      if (corner.startsWith('t')) {
        candidates.add((face.y1 - DOCK_MARGIN) / ASPECT);
      } else {
        candidates.add((stage.height - DOCK_MARGIN - face.y2) / ASPECT);
      }
    }
    let cornerBest: { w: number; overlap: number } | null = null;
    for (const w of candidates) {
      const clamped = Math.min(Math.max(w, wMin), wCap);
      const overlap = rectArea(intersection(dockedRectAtCorner(corner, clamped, stage), face));
      const better =
        cornerBest === null ||
        overlap < cornerBest.overlap - 1e-6 ||
        (Math.abs(overlap - cornerBest.overlap) <= 1e-6 && clamped > cornerBest.w);
      if (better) cornerBest = { w: clamped, overlap };
    }
    if (cornerBest === null) continue;
    const wins =
      best === null ||
      cornerBest.overlap < best.overlap - 1e-6 ||
      (Math.abs(cornerBest.overlap - best.overlap) <= 1e-6 && cornerBest.w > best.w);
    if (wins) best = { corner, w: cornerBest.w, overlap: cornerBest.overlap };
  }

  if (best === null) {
    // Degenerate stage: smallest chart, bottom-right.
    const w = wMin;
    const rect = dockedRectAtCorner('br', w, stage);
    return {
      kind: 'dock',
      geometry: clampGeometry(
        { x: rect.x1 / stage.width, y: rect.y1 / stage.height, w: w / stage.width },
        stage,
      ),
    };
  }
  const rect = dockedRectAtCorner(best.corner, best.w, stage);
  return {
    kind: 'dock',
    geometry: clampGeometry(
      { x: rect.x1 / stage.width, y: rect.y1 / stage.height, w: best.w / stage.width },
      stage,
    ),
  };
}

/**
 * The floating chart inset. Positions itself inside its parent element
 * (`.stage-inset-layer`, which fills the stage); measures that parent via
 * ResizeObserver so window resizes re-clamp the pane into the stage — or,
 * before the customer's first move, re-evaluate the face-aware placement.
 */
export function Inset({
  storageKey,
  label,
  children,
  focused = false,
  fillHeight = null,
  targets = [],
  onAutoInvert = undefined,
}: InsetProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<StageBox | null>(null);
  const [geometry, setGeometry] = useState<InsetGeometry | null>(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  // False until the customer moves or resizes the pane: until then the
  // placement is ours to re-evaluate on every stage resize.
  const userMovedRef = useRef(false);
  // Last invert decision reported through onAutoInvert.
  const invertRef = useRef(false);

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

  const stageElement = useCallback((): HTMLElement | null => {
    const layer = rootRef.current?.parentElement;
    const element = layer?.parentElement;
    return element instanceof HTMLElement ? element : null;
  }, []);

  const reportInvert = useCallback(
    (invert: boolean) => {
      if (invertRef.current === invert) return;
      invertRef.current = invert;
      onAutoInvert?.(invert);
    },
    [onAutoInvert],
  );

  // First metrics: restore the customer's saved geometry, or evaluate the
  // face-aware first-load placement.
  useEffect(() => {
    if (stage === null || geometry !== null) return;
    const stored = loadGeometry(storageKey);
    if (stored !== null) {
      userMovedRef.current = true;
      setGeometry(clampGeometry(stored, stage));
      return;
    }
    const placement = computeAutoPlacement(stage, faceRectInStage(stageElement()));
    reportInvert(placement.kind === 'invert');
    if (placement.kind === 'dock') setGeometry(placement.geometry);
  }, [stage, geometry, storageKey, stageElement, reportInvert]);

  // On stage resize: re-clamp the customer's geometry, or keep evaluating
  // the face-aware placement until they have moved it.
  useEffect(() => {
    if (stage === null) return;
    setGeometry(current => {
      if (current === null) return current;
      if (userMovedRef.current) return clampGeometry(current, stage);
      const placement = computeAutoPlacement(stage, faceRectInStage(stageElement()));
      reportInvert(placement.kind === 'invert');
      if (placement.kind === 'invert') return current;
      const next = placement.geometry;
      if (
        Math.abs(next.x - current.x) < 1e-6 &&
        Math.abs(next.y - current.y) < 1e-6 &&
        Math.abs(next.w - current.w) < 1e-6
      ) {
        return current;
      }
      return next;
    });
  }, [stage, stageElement, reportInvert]);

  const persist = useCallback(
    (next: InsetGeometry) => {
      userMovedRef.current = true;
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
    const next = clampGeometry({ x: x / stage.width, y: y / stage.height, w: geometry.w }, stage);
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
    const step = Math.max(KEY_STEP * stage.width, 4);
    let x = geometry.x * stage.width;
    let y = geometry.y * stage.height;
    let w = width;
    if (event.altKey) {
      const grow = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
      const wMax = Math.min(INSET_MAX_W, (0.9 * stage.height) / ASPECT / stage.width);
      w = Math.min(
        Math.max(width + grow * KEY_RESIZE_STEP * stage.width, INSET_MIN_W * stage.width),
        Math.max(wMax, INSET_MIN_W) * stage.width,
      );
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
    // Awaiting first stage metrics (or inverted): reserve the footprint
    // invisibly so the host layer still has a measurable child.
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
