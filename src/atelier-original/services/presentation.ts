// Type-only shim for src/atelier-original/components (verbatim atelier/
// ReadingStage copies). Only the exported presentation TYPES are carried,
// byte-identical to the original src/services/presentation.ts; the reducer
// half of that module is intentionally not carried — its cue/receipt
// behavior belongs to the original's inference rail, and view/panel swaps
// are driven directly by this repo's compositions.

export type PresentationView = 'chart' | 'atelier';
export type PresentationPanel = 'selection' | 'conversation';
export type PresentationAction = { type: 'focus'; targets: string[] } | { type: 'clear' } | { type: 'view'; view: PresentationView } | { type: 'panel'; panel: PresentationPanel };
export interface PresentationCue { offset: number; action: PresentationAction }
export interface PresentationReceipt { sequence: number; chartKey: string; action: PresentationAction; status: 'applied' | 'rejected' }
export interface PresentationState { chartKey: string; selectedTargets: string[]; focusTargets: string[]; view: PresentationView; panel: PresentationPanel; follow: boolean; sequence: number; lastReceipt: PresentationReceipt | null }
