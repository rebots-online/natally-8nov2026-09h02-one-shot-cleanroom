// Type-only shim for src/atelier-original/components/atelier/AtelierCharacter.tsx
// (verbatim copy). It imports only this type; the performance event itself is
// dispatched by the voice rail. The type below is byte-identical to the
// original src/services/voiceService.ts export.

export type NatallyVoicePerformance = { state: 'started' | 'word' | 'ended'; charIndex?: number; text?: string; durationMs?: number };
