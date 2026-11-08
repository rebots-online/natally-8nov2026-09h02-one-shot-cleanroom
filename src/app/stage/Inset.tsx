// The dockable, resizable chart inset (DOCS/ARCHITECTURE.md §Chart inset —
// clean-room, written from the architecture words only). Whichever pane is
// not in focus floats over the stage from first load; drag anywhere across
// the full stage and it docks near an edge or corner on release; a corner
// grip and Alt+arrow keys resize, arrow keys move; position and size
// persist per account in localStorage.
//
// Size is set by usefulness, not by a percentage: the floor is the smallest
// inset at which every individual house number and every individual planet
// symbol on the wheel can be told apart and read, with every body a
// fingertip-sized (~44 CSS px) target. N bodies sit around the wheel's rim,
// so packing N 44 px targets on the circumference 2πr needs a wheel
// diameter of about N·44/π (≈196 px for a full 14-body wheel) — house
// numbers, evenly spaced at 30°, are comfortably readable inside that.
// Above the floor the inset prefers larger, up to 60% of the stage; the
// customer can resize anywhere from the floor to that cap.
//
// The inset moves like a card: picked up anywhere on its surface, with a
// short move threshold so a tap without movement still selects the
// planet/sign/house/aspect under the pointer — moving and exploring never
// fight.
//
// First-load placement serves one intent: the customer can always see both
// Natally and her chart well enough to use them — neither defeats the
// other. Measured against the on-screen box of her rendered head
// (`.atelier-character__head`): roomy stages get the largest corner/size
// above the floor that leaves her face clear; tight stages get the least
// overlap at the largest size that achieves it; when the floor itself
// cannot sit beside her face (or the stage cannot fit the floor at all)
// the stage inverts — the chart takes focus and Natally becomes the inset,
// the same swap a reading uses. Placement re-evaluates on resize until the
// customer moves the pane; after that the customer's own choice always
// wins. When the chart is focused (`focused`) the same pane fills the
// stage's visual area.

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

/** Fingertip-sized hit target per body, in CSS px (the architecture's ~44). */
export const BODY_TARGET_PX = 44;
/** Inset width cap as a fraction of stage width (the architecture's 60%). */
export const INSET_MAX_W = 0.6;
/** Height = width × aspect; the wheel is square. */
const ASPECT = 1;
/** Inset chrome that is not wheel: the drag bar plus both borders, px. */
const CHROME_PX = 32;
/** Breathing room between a docked inset and the stage edge, in px. */
const DOCK_MARGIN = 12;
/** How close to an edge (fraction of that axis) a release must land to dock. */
const DOCK_REACH = 0.24;
/** Pointer travel that turns a touch into a card drag, in px. */
const DRAG_THRESHOLD_PX = 5;
/** Keyboard nudge as a fraction of stage width; Alt nudge resizes. */
const KEY_STEP = 0.012;
const KEY_RESIZE_STEP = 0.02;
/** When the floor-sized inset still hides this much of her face on every
 *  corner, it cannot sit beside her: the chart takes focus instead. */
const FACE_COVERED_INVERT = 0.8;
/** Bodies on a full wheel, when the caller cannot supply the live count. */
const DEFAULT_BODY_COUNT = 14;

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
  /** Bodies drawn on this wheel; sets the usefulness size floor. */
  bodyCount?: number;
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

/**
 * The usefulness floor: the smallest inset width at which every body on the
 * wheel is a ~44 px target on the rim — N·44/π of wheel plus the chrome.
 */
export function insetFloorPx(bodyCount: number): number {
  const count = Math.max(1, Math.min(isFiniteNumber(bodyCount) ? bodyCount : DEFAULT_BODY_COUNT, 40));
  return Math.ceil((count * BODY_TARGET_PX) / Math.PI) + CHROME_PX;
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

/** The largest width (px) the stage allows: 60% of width, or the height cap. */
function allowedWidthPx(stage: StageBox): number {
  return Math.max(1, Math.min(INSET_MAX_W * stage.width, (0.9 * stage.height) / ASPECT));
}

/** Clamp geometry fractions into the stage for the current box and floor. */
function clampGeometry(geometry: InsetGeometry, stage: StageBox, floorPx: number): InsetGeometry {
  const maxF = allowedWidthPx(stage) / stage.width;
  const minF = Math.min(floorPx / stage.width, maxF);
  const w = Math.min(Math.max(geometry.w, minF), maxF);
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
 * First-load placement from the intent: roomy → the largest corner/size
 * from the usefulness floor up to the cap that leaves her face clear;
 * tight → the least overlap at the largest size that achieves it; a floor
 * the stage cannot fit, or that would hide her face on every corner even
 * at its smallest, is too small for both — the chart takes focus.
 * Overlap with size is monotone per corner, so each corner's best sits at
 * the size breakpoints where the growing inset edges cross her face edges.
 */
function computeAutoPlacement(stage: StageBox, face: Rect | null, floorPx: number): AutoPlacement {
  const cap = allowedWidthPx(stage);
  // The stage cannot offer a useful floating chart at all.
  if (floorPx > cap) return { kind: 'invert' };

  const faceArea = rectArea(face);
  if (face !== null && faceArea > 0) {
    const leastHidden = CORNERS.reduce((best, corner) => {
      const hidden = rectArea(intersection(dockedRectAtCorner(corner, floorPx, stage), face)) / faceArea;
      return Math.min(best, hidden);
    }, Number.POSITIVE_INFINITY);
    // Even at the floor every corner would mostly hide her: it cannot sit
    // beside her face.
    if (leastHidden > FACE_COVERED_INVERT) return { kind: 'invert' };
  }

  let best: { corner: Corner; w: number; overlap: number } | null = null;
  for (const corner of CORNERS) {
    // Widths whose growing inset edges just reach the face's near edges;
    // overlap is piecewise linear between these breakpoints.
    const candidates = new Set<number>([floorPx, cap]);
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
      const clamped = Math.min(Math.max(w, floorPx), cap);
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
    // Degenerate stage: the floor, bottom-right.
    const rect = dockedRectAtCorner('br', floorPx, stage);
    return {
      kind: 'dock',
      geometry: clampGeometry(
        { x: rect.x1 / stage.width, y: rect.y1 / stage.height, w: floorPx / stage.width },
        stage,
        floorPx,
      ),
    };
  }
  const rect = dockedRectAtCorner(best.corner, best.w, stage);
  return {
    kind: 'dock',
    geometry: clampGeometry(
      { x: rect.x1 / stage.width, y: rect.y1 / stage.height, w: best.w / stage.width },
      stage,
      floorPx,
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
  bodyCount = DEFAULT_BODY_COUNT,
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
  const floorPx = insetFloorPx(bodyCount);

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
      setGeometry(clampGeometry(stored, stage, floorPx));
      return;
    }
    const placement = computeAutoPlacement(stage, faceRectInStage(stageElement()), floorPx);
    reportInvert(placement.kind === 'invert');
    if (placement.kind === 'dock') setGeometry(placement.geometry);
  }, [stage, geometry, storageKey, stageElement, reportInvert, floorPx]);

  // On stage resize: re-clamp the customer's geometry, or keep evaluating
  // the face-aware placement until they have moved it.
  useEffect(() => {
    if (stage === null) return;
    setGeometry(current => {
      if (current === null) return current;
      if (userMovedRef.current) return clampGeometry(current, stage, floorPx);
      const placement = computeAutoPlacement(stage, faceRectInStage(stageElement()), floorPx);
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
  }, [stage, stageElement, reportInvert, floorPx]);

  const persist = useCallback(
    (next: InsetGeometry) => {
      userMovedRef.current = true;
      storeGeometry(storageKey, next);
    },
    [storageKey],
  );

  /** Card drag: armed on press anywhere, live after a short move threshold,
   *  so a plain tap still reaches the chart under the pointer. */
  const armRef = useRef<{ pointerId: number; x: number; y: number; grabX: number; grabY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);

  const pointInStage = (event: ReactPointerEvent<HTMLElement>): { x: number; y: number } => {
    const host = rootRef.current?.parentElement;
    const rect = host?.getBoundingClientRect();
    const x = rect === undefined ? event.clientX : event.clientX - rect.left;
    const y = rect === undefined ? event.clientY : event.clientY - rect.top;
    return { x, y };
  };

  const onSurfacePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || stage === null || geometry === null) return;
    // The resizer stops propagation before this; the bar is chrome only.
    const point = pointInStage(event);
    armRef.current = {
      pointerId: event.pointerId,
      x: point.x,
      y: point.y,
      grabX: point.x - geometry.x * stage.width,
      grabY: point.y - geometry.y * stage.height,
    };
  };

  const onSurfacePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (stage === null || geometry === null) return;
    const arm = armRef.current;
    if (arm !== null && arm.pointerId === event.pointerId && !dragging) {
      const point = pointInStage(event);
      if (Math.hypot(point.x - arm.x, point.y - arm.y) < DRAG_THRESHOLD_PX) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    if (!dragging || arm === null || arm.pointerId !== event.pointerId) return;
    const point = pointInStage(event);
    const width = geometry.w * stage.width;
    const height = width * ASPECT;
    const x = Math.min(Math.max(point.x - arm.grabX, 0), Math.max(0, stage.width - width));
    const y = Math.min(Math.max(point.y - arm.grabY, 0), Math.max(0, stage.height - height));
    setGeometry({ ...geometry, x: x / stage.width, y: y / stage.height });
  };

  const onSurfacePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const arm = armRef.current;
    armRef.current = null;
    if (!dragging || arm === null || arm.pointerId !== event.pointerId || stage === null || geometry === null) {
      // A tap without movement: release silently so the chart's own click
      // lands on the planet, sign, house or aspect under the pointer.
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
    const next = clampGeometry({ x: x / stage.width, y: y / stage.height, w: geometry.w }, stage, floorPx);
    setGeometry(next);
    persist(next);
  };

  /** Resize from the corner grip, keeping the aspect and the floor→cap span. */
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
    const cap = allowedWidthPx(stage);
    const width = Math.min(
      Math.max(resizeRef.current.startW + delta, Math.min(floorPx, cap)),
      cap,
    );
    setGeometry(clampGeometry({ ...geometry, w: width / stage.width }, stage, floorPx));
  };

  const onGripPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizing || geometry === null) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
    const cap = allowedWidthPx(stage);
    const lo = Math.min(floorPx, cap);
    let x = geometry.x * stage.width;
    let y = geometry.y * stage.height;
    let w = width;
    if (event.altKey) {
      const grow = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
      w = Math.min(Math.max(width + grow * KEY_RESIZE_STEP * stage.width, lo), cap);
    } else if (event.key === 'ArrowLeft') x -= step;
    else if (event.key === 'ArrowRight') x += step;
    else if (event.key === 'ArrowUp') y -= step;
    else if (event.key === 'ArrowDown') y += step;
    const next = clampGeometry(
      { x: x / stage.width, y: y / stage.height, w: w / stage.width },
      stage,
      floorPx,
    );
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
      onPointerDown={onSurfacePointerDown}
      onPointerMove={onSurfacePointerMove}
      onPointerUp={onSurfacePointerUp}
      onPointerCancel={onSurfacePointerUp}
    >
      <div className="chart-inset__bar">
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
