// Presentation state (DOCS/ARCHITECTURE.md §First reveal and speech-driven
// presentation): one reducer over the stage's PresentationState. focus and
// clear set the highlighted targets; view swaps chart⇄inset (chart focused →
// Natally becomes the inset). A manual view choice turns `follow` off and
// automatic view cues then stop — highlight cues keep following her voice.

export type PresentationView = 'atelier' | 'chart';

/** The stage's presentation state (consumed by the verbatim ReadingStage
 *  and by our inset layer; the field shape is the frozen wire contract). */
export interface PresentationState {
  /** Identity of the chart on the table; changing it resets the stage. */
  chartKey: string;
  /** Targets the customer pointed at (hover/click in the wheel). */
  selectedTargets: string[];
  /** Targets she is highlighting as she narrates. */
  focusTargets: string[];
  /** Which pane is focused. */
  view: PresentationView;
  /** The conversation slot below the stage. */
  panel: 'conversation';
  /** False once the customer chose a view by hand: auto view cues stop. */
  follow: boolean;
  /** Bumped on every applied action so the stage can key its reactions. */
  sequence: number;
  lastReceipt: null;
}

export type PresentationAction =
  | { type: 'chart'; key: string }
  | { type: 'focus'; targets: string[] }
  | { type: 'clear' }
  | { type: 'view'; view: PresentationView; manual?: boolean };

export const initialPresentation: PresentationState = {
  chartKey: '',
  selectedTargets: [],
  focusTargets: [],
  view: 'atelier',
  panel: 'conversation',
  follow: true,
  sequence: 0,
  lastReceipt: null,
};

export function presentationReducer(
  state: PresentationState,
  action: PresentationAction,
): PresentationState {
  switch (action.type) {
    case 'chart':
      // A new chart on the table: the stage starts fresh, following her.
      if (action.key === state.chartKey) return state;
      return {
        ...initialPresentation,
        chartKey: action.key,
        sequence: state.sequence + 1,
      };
    case 'focus': {
      if (
        state.focusTargets.length === action.targets.length &&
        state.focusTargets.every((target, i) => target === action.targets[i])
      ) {
        return state;
      }
      return {
        ...state,
        focusTargets: action.targets,
        sequence: state.sequence + 1,
      };
    }
    case 'clear':
      if (state.focusTargets.length === 0) return state;
      return { ...state, focusTargets: [], sequence: state.sequence + 1 };
    case 'view': {
      // A manual choice turns follow off; automatic view cues stop after
      // that (they arrive here without `manual` and are dropped).
      if (!action.manual && !state.follow) return state;
      if (action.view === state.view && (action.manual !== true || state.follow)) {
        return action.manual === true && state.follow
          ? { ...state, follow: false }
          : state;
      }
      return {
        ...state,
        view: action.view,
        follow: action.manual === true ? false : state.follow,
        sequence: state.sequence + 1,
      };
    }
  }
}
