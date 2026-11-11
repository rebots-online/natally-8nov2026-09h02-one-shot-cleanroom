// The dockable, resizable chart inset (DOCS/ARCHITECTURE.md §Chart inset —
// clean-room, written from the architecture words only). Whichever pane is
// not in focus floats over the stage from first load; drag anywhere across
// the full stage and it docks near an edge or corner on release; corner
// grips on all four corners and Alt+arrow keys resize, arrow keys move;
// position, size and docked/floating mode persist per account in
// localStorage.
//
// Size is set by usefulness, not by a percentage: the floor is the smallest
// inset at which every individual house number and every individual planet
// symbol on the wheel can be told apart and read, with every body a
// fingertip-sized (~44 CSS px) target. N bodies sit around the wheel's rim,
// so packing N 44 px targets on the circumference 2πr needs a wheel
// diameter of about N·44/π (≈196 px for a full 14-body wheel). Glyph
// legibility usually demands more: house numbers are 68 px digits on a
// 128 px sprite at 0.28 world scale and planet symbols 54 px at 0.34–0.40,
// and the wheel's 4.86-unit diameter fills about 0.74 of the card's
// content width — the smallest glyph is only GLYPH_MIN_PX tall once the
// card reaches ~46 px per legibility pixel. Above the floor the inset
// prefers larger, up to 60% of the stage; the customer can resize anywhere
// from the floor to that cap.
//
// On stages large enough, the chart docks BESIDE the scene — side by side
// or stacked, whichever fits — and the scene re-zooms into the remaining
// space, so neither obscures the other; the stage is laid out through
// `data-inset-dock` + `--inset-dock-size`, which the card sets on its host
// stage and layer. Dragging the card back over the scene lifts it out to
// floating; releasing a floating card at the scene side (right edge) or
// beneath (bottom edge) docks it beside again. Smaller stages fall back to
// the floating-card ranges.
//
// The inset moves like a card: picked up by its chrome (bar, border,
// anywhere off the wheel), with a short move threshold so a tap without
// movement still selects the planet/sign/house/aspect under the pointer.
// A mouse/pen grab on the wheel itself is the wheel's own gesture — 3D tilt
// and momentum spin — never a card drag, so moving and exploring never
// fight. Touch pointers cannot hover, so they follow the press-hold rule:
// holding LONG_PRESS_MS arms the card drag (then any movement drags);
// moving sooner hands the gesture to the wheel beneath; a quick tap acts
// as hover+click on the component it lands on, and a tap where no
// component sits reports `onSwap` — after a tick, so a component tap the
// chart claims through `onComponentTap` cancels the swap. A drag never
// swaps or selects.
//
// The card is the chart's inset boundary (`data-chart-callout-boundary` +
// `data-chart-inset`), so the chart clamps its tooltip to the card and
// runs its two-path inset clicks. Focused (the chart view) the boundary
// marker drops away and the same pane fills the stage's visual area — one
// element throughout, so a view swap re-lays-out the chart without ever
// remounting it.
//
// First-load floating placement serves one intent: the customer can always
// see both Natally and her chart well enough to use them — neither defeats
// the other. Measured against the on-screen box of her rendered head
// (`.atelier-character__head`): roomy stages get the largest corner/size
// above the floor that leaves her face clear; tight stages get the least
// overlap at the largest size that achieves it; when the floor itself
// cannot sit beside her face (or the stage cannot fit the floor at all)
// the stage inverts — the chart takes focus and Natally becomes the inset,
// the same swap a reading uses. Placement re-evaluates on resize until the
// customer moves the pane; after that the customer's own choice always
// wins.

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
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
/**
 * Smallest on-screen height (CSS px) at which every individual house
 * number and planet symbol on the wheel is still readable; drives the
 * glyph-legibility term of the size floor.
 */
const GLYPH_MIN_PX = 10;
/** Touch press-hold that arms a card drag (movement before it is the
 *  wheel's gesture, not the card's). */
const LONG_PRESS_MS = 500;
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
/** The scene's readable minimum width when the chart docks beside it. */
const SCENE_MIN_W = 320;
/** The scene + conversation minimum above a stacked chart row. */
const STACK_MIN_H = 520;
/** Gap between the scene and a chart docked beside it. */
const DOCK_GAP = 16;

interface InsetGeometry {
  /** Left edge as a fraction of stage width. */
  x: number;
  /** Top edge as a fraction of stage height. */
  y: number;
  /** Width as a fraction of stage width (height keeps the aspect). */
  w: number;
}

/** Where the chart lives: docked beside the scene (side by side, or stacked
 *  under it) or floating over the stage. */
export type InsetMode = 'side' | 'stack' | 'floating';

interface InsetState {
  mode: InsetMode;
  geometry: InsetGeometry;
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
   * Click/tap on the inset where no chart component was hit: swap the two
   * views. Component taps the chart claims (through `onComponentTap`)
   * cancel the pending swap.
   */
  onSwap?: () => void;
  /** Chart component taps, forwarded to the chart child element. */
  onComponentTap?: (target: string) => void;
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
 * The usefulness floor: the larger of the fingertip rim — the smallest
 * inset at which every body on the wheel is a ~44 px target on the rim,
 * N·44/π of wheel plus the chrome — and the glyph-legibility floor, the
 * smallest card at which the wheel's smallest glyph (a live-sky planet
 * symbol: 54 px on a 128 px sprite at 0.34 world scale = 18.36/128 ≈ 0.143
 * world units, against house numbers at 68 px × 0.28 = 0.149) still stands
 * GLYPH_MIN_PX tall on screen. The wheel's 2 × 2.43 = 4.86-unit diameter
 * fills ≈0.74 of the card's content width (fov 38°, camera ~9.2 units out;
 * 0.736 measured pixel-wise on the dev build), so the glyph is GLYPH_MIN_PX
 * tall only at GLYPH_MIN_PX × 4.86 × 128 / (18.36 × 0.74) ≈ 46 px per
 * legibility pixel.
 */
export function insetFloorPx(bodyCount: number): number {
  const count = Math.max(1, Math.min(isFiniteNumber(bodyCount) ? bodyCount : DEFAULT_BODY_COUNT, 40));
  const rim = Math.ceil((count * BODY_TARGET_PX) / Math.PI) + CHROME_PX;
  const glyph = Math.ceil((GLYPH_MIN_PX * 4.86 * 128) / (54 * 0.34 * 0.74)) + 2;
  return Math.max(rim, glyph);
}

/** Read and validate the stored state; null when absent or corrupt. */
function loadState(storageKey: string): InsetState | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as Record<string, unknown>;
    if (!isFiniteNumber(candidate.x) || !isFiniteNumber(candidate.y) || !isFiniteNumber(candidate.w)) {
      return null;
    }
    const geometry = { x: candidate.x, y: candidate.y, w: candidate.w };
    const mode = candidate.mode;
    return {
      mode: mode === 'side' || mode === 'stack' ? mode : 'floating',
      geometry,
    };
  } catch {
    return null;
  }
}

function storeState(storageKey: string, state: InsetState): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ mode: state.mode, ...state.geometry }));
  } catch {
    // Storage unavailable (private mode/quota): the inset lives in memory.
  }
}

/** The largest width (px) the stage allows: 60% of width, or the height cap. */
function allowedWidthPx(stage: StageBox): number {
  return Math.max(1, Math.min(INSET_MAX_W * stage.width, (0.9 * stage.height) / ASPECT));
}

/** Side-by-side docking needs the scene's minimum plus a floor-sized chart. */
function sideFits(stage: StageBox, floorPx: number): boolean {
  return stage.width >= SCENE_MIN_W + floorPx + DOCK_GAP;
}

/** Stacked docking needs the scene's minimum above a floor-sized chart. */
function stackFits(stage: StageBox, floorPx: number): boolean {
  return stage.height >= STACK_MIN_H + floorPx;
}

/** The width the chart prefers when docked beside the scene. */
function dockedWidthPx(stage: StageBox, floorPx: number): number {
  const cap = allowedWidthPx(stage);
  const beside = stage.width - SCENE_MIN_W - DOCK_GAP;
  return Math.min(Math.max(Math.min(cap, beside), floorPx), cap);
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
 * First-load floating placement from the intent: roomy → the largest
 * corner/size from the usefulness floor up to the cap that leaves her face
 * clear; tight → the least overlap at the largest size that achieves it; a
 * floor the stage cannot fit, or that would hide her face on every corner
 * even at its smallest, is too small for both — the chart takes focus.
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
 * The chart inset — floating over the stage, or docked beside the scene on
 * stages large enough (the stage and host layer are laid out through the
 * `data-inset-dock` attribute and `--inset-dock-size` this component sets
 * on them). Positions itself inside its parent element
 * (`.stage-inset-layer`, which fills the stage); measures that parent via
 * ResizeObserver so window resizes re-clamp the pane into the stage — or,
 * before the customer's first move, re-evaluate the placement.
 */
export function Inset({
  storageKey,
  label,
  children,
  focused = false,
  fillHeight = null,
  targets = [],
  bodyCount = DEFAULT_BODY_COUNT,
  onSwap = undefined,
  onComponentTap = undefined,
  onAutoInvert = undefined,
}: InsetProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<StageBox | null>(null);
  const [geometry, setGeometry] = useState<InsetGeometry | null>(null);
  const [mode, setMode] = useState<InsetMode>('floating');
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  // False until the customer moves or resizes the pane: until then the
  // placement is ours to re-evaluate on every stage resize.
  const userMovedRef = useRef(false);
  // Restored from storage exactly once, on the first stage metrics.
  const restoredRef = useRef(false);
  // Last invert decision reported through onAutoInvert.
  const invertRef = useRef(false);
  const floorPx = insetFloorPx(bodyCount);

  // Measure the host stage (the layer's parent): floating, the layer fills
  // it exactly; docked, the layer is confined to the dock slot while the
  // stage remains the space the chart is placed within.
  useLayoutEffect(() => {
    const stageEl = rootRef.current?.parentElement?.parentElement;
    if (stageEl === null || stageEl === undefined) return;
    const observer = new ResizeObserver(entries => {
      const box = entries[entries.length - 1];
      if (box !== undefined) {
        const { width, height } = box.contentRect;
        if (width > 0 && height > 0) setStage({ width, height });
      }
    });
    observer.observe(stageEl);
    return () => observer.disconnect();
  }, []);

  const hostLayer = useCallback((): HTMLElement | null => {
    const layer = rootRef.current?.parentElement;
    return layer instanceof HTMLElement ? layer : null;
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

  // Restore the customer's saved state once, on the first stage metrics (a
  // dock that no longer fits on this screen falls back to floating).
  useEffect(() => {
    if (stage === null || restoredRef.current) return;
    restoredRef.current = true;
    const stored = loadState(storageKey);
    if (stored === null) return;
    userMovedRef.current = true;
    const fits =
      (stored.mode === 'side' && sideFits(stage, floorPx)) ||
      (stored.mode === 'stack' && stackFits(stage, floorPx)) ||
      stored.mode === 'floating';
    setMode(fits ? stored.mode : 'floating');
    setGeometry(clampGeometry(stored.geometry, stage, floorPx));
  }, [stage, storageKey, floorPx]);

  // On stage metrics: keep the customer's choice clamped and fitting, or —
  // until their first move — evaluate where the chart belongs.
  useEffect(() => {
    if (stage === null) return;
    if (userMovedRef.current) {
      if (mode === 'side' && !sideFits(stage, floorPx)) setMode('floating');
      else if (mode === 'stack' && !stackFits(stage, floorPx)) setMode('floating');
      setGeometry(current => (current === null ? current : clampGeometry(current, stage, floorPx)));
      return;
    }
    if (sideFits(stage, floorPx) || stackFits(stage, floorPx)) {
      // Large enough to dock beside the scene: neither obscures the other,
      // the scene re-zooms into the remaining space.
      reportInvert(false);
      setMode(sideFits(stage, floorPx) ? 'side' : 'stack');
      setGeometry(current =>
        clampGeometry(
          current ?? { x: 0.5, y: 0.5, w: dockedWidthPx(stage, floorPx) / stage.width },
          stage,
          floorPx,
        ),
      );
      return;
    }
    setMode('floating');
    const placement = computeAutoPlacement(stage, faceRectInStage(stageElement()), floorPx);
    reportInvert(placement.kind === 'invert');
    if (placement.kind === 'dock') setGeometry(placement.geometry);
  }, [stage, mode, floorPx, stageElement, reportInvert]);

  // Lay out the host stage and layer for the current mode. While the chart
  // is focused the dock yields to the full-stage fill.
  const dockSizePx =
    stage === null || geometry === null
      ? 0
      : Math.min(Math.max(geometry.w * stage.width, floorPx), allowedWidthPx(stage));
  useEffect(() => {
    const layer = hostLayer();
    const stageEl = stageElement();
    const dock = !focused && mode !== 'floating' ? mode : '';
    for (const element of [layer, stageEl]) {
      if (element === null) continue;
      if (dock === '') {
        delete element.dataset.insetDock;
      } else {
        element.dataset.insetDock = dock;
      }
    }
    if (dock === '') {
      stageEl?.style.removeProperty('--inset-dock-size');
    } else if (dockSizePx > 0) {
      stageEl?.style.setProperty('--inset-dock-size', `${Math.round(dockSizePx)}px`);
    }
  }, [mode, focused, dockSizePx, hostLayer, stageElement]);

  const persist = useCallback(
    (nextMode: InsetMode, nextGeometry: InsetGeometry) => {
      userMovedRef.current = true;
      storeState(storageKey, { mode: nextMode, geometry: nextGeometry });
    },
    [storageKey],
  );

  // A tap where no component sits becomes a swap only after the chart's own
  // click for the same tap has had its chance to claim the target: the
  // chart's click fires after pointerup, and cancels this timer through the
  // onComponentTap forwarded into it.
  const swapTimerRef = useRef<number | null>(null);
  const onSwapRef = useRef(onSwap);
  onSwapRef.current = onSwap;
  const cancelPendingSwap = useCallback(() => {
    if (swapTimerRef.current !== null) {
      window.clearTimeout(swapTimerRef.current);
      swapTimerRef.current = null;
    }
  }, []);
  const onComponentTapRef = useRef(onComponentTap);
  onComponentTapRef.current = onComponentTap;
  const handleChartComponentTap = useCallback(
    (target: string) => {
      cancelPendingSwap();
      onComponentTapRef.current?.(target);
    },
    [cancelPendingSwap],
  );
  // Forward onComponentTap into the chart element itself. A plain host
  // element (a loading placeholder, or a caller's wrapper div) has no prop
  // to receive it, so it is left untouched.
  const forwardedChart =
    isValidElement(children) && typeof children.type !== 'string'
      ? cloneElement(children as ReactElement<{ onComponentTap?: (target: string) => void }>, {
          onComponentTap: handleChartComponentTap,
        })
      : children;

  // The touch hold that arms a card drag, plus any pending swap, must never
  // fire after the card goes away.
  const holdTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      cancelPendingSwap();
      if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    },
    [cancelPendingSwap],
  );

  /** Card drag: armed on press anywhere, live after a short move threshold
   *  (mouse/pen) or a LONG_PRESS_MS hold (touch), so a plain tap still
   *  reaches the chart under the pointer and a touch that moves before the
   *  hold stays the wheel's gesture. Dragging a docked card lifts it out
   *  beside the scene to floating. */
  const armRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    grabX: number;
    grabY: number;
    touch: boolean;
    /** Pressed on the wheel itself (its canvas): a mouse/pen move there is
     *  the wheel's tilt/spin gesture, never a card drag. */
    onWheel: boolean;
    held: boolean;
    cancelled: boolean;
  } | null>(null);
  const resizeRef = useRef<{ corner: Corner; startX: number; startW: number; startLeft: number; startTop: number } | null>(
    null,
  );

  const pointInStage = (event: ReactPointerEvent<HTMLElement>): { x: number; y: number } => {
    const rect = stageElement()?.getBoundingClientRect();
    const x = rect === undefined ? event.clientX : event.clientX - rect.left;
    const y = rect === undefined ? event.clientY : event.clientY - rect.top;
    return { x, y };
  };

  /** The card's current on-stage position, floating or docked. */
  const cardRectInStage = (): { x: number; y: number; w: number; h: number } | null => {
    const card = rootRef.current?.getBoundingClientRect();
    const host = stageElement()?.getBoundingClientRect();
    if (card === undefined || host === undefined || stage === null) return null;
    return {
      x: card.left - host.left,
      y: card.top - host.top,
      w: card.width,
      h: card.height,
    };
  };

  const onSurfacePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (focused) return;
    if (event.button !== 0 || stage === null || geometry === null) return;
    // The resizer stops propagation before this; the bar is chrome only.
    cancelPendingSwap();
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const point = pointInStage(event);
    const card = cardRectInStage();
    const touch = event.pointerType === 'touch';
    const target = event.target instanceof Element ? event.target : null;
    const onWheel = target !== null && target.closest('.chart-inset__content canvas') !== null;
    armRef.current = {
      pointerId: event.pointerId,
      x: point.x,
      y: point.y,
      grabX: card === null ? 0 : point.x - card.x,
      grabY: card === null ? 0 : point.y - card.y,
      touch,
      onWheel,
      held: false,
      cancelled: false,
    };
    if (touch) {
      const pointerId = event.pointerId;
      holdTimerRef.current = window.setTimeout(() => {
        holdTimerRef.current = null;
        const arm = armRef.current;
        if (arm === null || arm.pointerId !== pointerId) return;
        arm.held = true;
      }, LONG_PRESS_MS);
    }
  };

  const onSurfacePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (stage === null || geometry === null) return;
    const arm = armRef.current;
    if (arm !== null && arm.pointerId === event.pointerId && !dragging) {
      const point = pointInStage(event);
      const distance = Math.hypot(point.x - arm.x, point.y - arm.y);
      if (arm.touch && !arm.held) {
        // Moved before the hold completed: the wheel's own gesture (rotate,
        // pinch), never a card drag — for the rest of this touch.
        if (distance >= DRAG_THRESHOLD_PX) arm.cancelled = true;
        return;
      }
      if (arm.cancelled) return;
      if (!arm.touch && distance < DRAG_THRESHOLD_PX) return;
      if (!arm.touch && arm.onWheel) {
        // Grabbed the wheel itself: the move is the wheel's 3D tilt and
        // momentum spin. The card stays put, and the release never swaps.
        arm.cancelled = true;
        return;
      }
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // A pointer the browser does not know (synthetic test events)
        // cannot be captured; the drag still tracks through move events.
      }
      setDragging(true);
      if (mode !== 'floating') {
        // Lift the docked card out under the pointer.
        const card = cardRectInStage();
        if (card !== null) {
          const width = Math.min(Math.max(card.w, floorPx), allowedWidthPx(stage));
          setMode('floating');
          setGeometry({
            x: (point.x - arm.grabX) / stage.width,
            y: (point.y - arm.grabY) / stage.height,
            w: width / stage.width,
          });
        }
      }
    }
    if (!dragging || arm === null || arm.pointerId !== event.pointerId) return;
    const point = pointInStage(event);
    const width = geometry.w * stage.width;
    const height = width * ASPECT;
    const x = Math.min(Math.max(point.x - arm.grabX, 0), Math.max(0, stage.width - width));
    const y = Math.min(Math.max(point.y - arm.grabY, 0), Math.max(0, stage.height - height));
    setGeometry({ ...geometry, x: x / stage.width, y: y / stage.height });
  };

  const onSurfacePointerUp = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const arm = armRef.current;
    armRef.current = null;
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (dragging && arm !== null && arm.pointerId === event.pointerId && stage !== null && geometry !== null) {
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

      // Released at the scene side or beneath: dock beside the scene again.
      if (nearRight && !nearTop && !nearBottom && sideFits(stage, floorPx)) {
        const next = clampGeometry(
          { ...geometry, w: dockedWidthPx(stage, floorPx) / stage.width },
          stage,
          floorPx,
        );
        setGeometry(next);
        setMode('side');
        persist('side', next);
        return;
      }
      if (nearBottom && !nearLeft && !nearRight && stackFits(stage, floorPx)) {
        setMode('stack');
        persist('stack', clampGeometry(geometry, stage, floorPx));
        return;
      }

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
      persist('floating', next);
      return;
    }
    // A tap without movement: hand it to the chart's own click first — a
    // tap on a component it claims cancels the swap — and swap only if
    // nothing claims it. Cancelled gestures (the wheel's rotation) and the
    // focused stage view never swap.
    if (arm === null || arm.cancelled || cancelled || focused) return;
    cancelPendingSwap();
    swapTimerRef.current = window.setTimeout(() => {
      swapTimerRef.current = null;
      onSwapRef.current?.();
    }, 0);
  };

  /** Resize from any corner grip: aspect-locked, anchored on the opposite
   *  corner, clamped to the floor→cap span. */
  const onGripPointerDown = (event: ReactPointerEvent<HTMLDivElement>, corner: Corner) => {
    if (focused) return;
    if (event.button !== 0 || stage === null || geometry === null) return;
    event.stopPropagation();
    cancelPendingSwap();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointers cannot be captured; moves still track.
    }
    const point = pointInStage(event);
    const card = cardRectInStage();
    resizeRef.current = {
      corner,
      startX: point.x,
      startW: geometry.w * stage.width,
      startLeft: card === null ? geometry.x * stage.width : card.x,
      startTop: card === null ? geometry.y * stage.height : card.y,
    };
    setResizing(true);
  };

  const onGripPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizing || stage === null || geometry === null || resizeRef.current === null) return;
    const point = pointInStage(event);
    const start = resizeRef.current;
    const grow =
      start.corner === 'tr' || start.corner === 'br' ? point.x - start.startX : start.startX - point.x;
    const cap = allowedWidthPx(stage);
    const width = Math.min(Math.max(start.startW + grow, Math.min(floorPx, cap)), cap);
    // The opposite corner stays put: a square card grows along both axes,
    // so the top shifts with the top grips and the left with the left ones.
    const shift = start.startW - width;
    const left = start.corner.endsWith('l') ? start.startLeft + shift : start.startLeft;
    const top = start.corner.startsWith('t') ? start.startTop + shift : start.startTop;
    setGeometry(
      clampGeometry(
        { x: left / stage.width, y: top / stage.height, w: width / stage.width },
        stage,
        floorPx,
      ),
    );
  };

  const onGripPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizing || geometry === null) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeRef.current = null;
    setResizing(false);
    persist(mode, geometry);
  };

  /** Arrow keys move the floating pane; Alt+arrow keys resize it anywhere. */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (focused) return;
    if (!event.key.startsWith('Arrow') || stage === null || geometry === null) return;
    if (mode !== 'floating' && !event.altKey) return;
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
    persist(mode, next);
  };

  // One element in every state (awaiting metrics, focused fill, floating,
  // docked) with the same children in the same order: the chart mounts once
  // and a view swap re-lays-out this card without remounting the chart.
  const cornerGrip = (corner: Corner) => (
    <div
      key={corner}
      className={`chart-inset__resizer chart-inset__resizer--${corner}`}
      aria-hidden="true"
      onPointerDown={event => onGripPointerDown(event, corner)}
      onPointerMove={onGripPointerMove}
      onPointerUp={onGripPointerUp}
      onPointerCancel={onGripPointerUp}
    />
  );

  return (
    <div
      ref={rootRef}
      className={
        focused
          ? 'chart-inset chart-inset-fill'
          : mode !== 'floating'
            ? 'chart-inset chart-inset--docked'
            : 'chart-inset'
      }
      role="region"
      aria-label={`${label} — drag to move, arrow keys to move, Alt and arrow keys to resize`}
      tabIndex={0}
      data-dragging={dragging || resizing}
      data-chart-callout-boundary=""
      data-chart-inset={focused ? undefined : 'true'}
      style={
        focused
          ? fillHeight !== null && fillHeight > 0
            ? { height: fillHeight }
            : undefined
          : mode === 'floating'
            ? {
                left: geometry === null || stage === null ? undefined : geometry.x * stage.width,
                top: geometry === null || stage === null ? undefined : geometry.y * stage.height,
                width: geometry === null || stage === null ? undefined : geometry.w * stage.width,
                height:
                  geometry === null || stage === null ? undefined : geometry.w * stage.width * ASPECT,
                visibility: stage === null || geometry === null ? 'hidden' : undefined,
              }
            : undefined
      }
      onKeyDown={onKeyDown}
      onPointerDown={onSurfacePointerDown}
      onPointerMove={onSurfacePointerMove}
      onPointerUp={event => onSurfacePointerUp(event, false)}
      onPointerCancel={event => onSurfacePointerUp(event, true)}
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
      <div className="chart-inset__content">
        {focused || (stage !== null && geometry !== null) ? forwardedChart : null}
      </div>
      {CORNERS.map(cornerGrip)}
    </div>
  );
}
