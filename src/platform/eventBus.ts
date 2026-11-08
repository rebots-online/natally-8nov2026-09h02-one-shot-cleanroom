// Tiny typed pub/sub. Feature modules add their events via module
// augmentation from their own files, keeping this map owner-free:
//
//   declare module '../platform/eventBus' {
//     interface PlatformEventMap {
//       'billing:granted': { usdMicros: number };
//     }
//   }

/** Event name → payload type. Empty until feature modules augment it. */
export interface PlatformEventMap {
  // Intentionally empty: no event names are invented here.
}

type Handler = (payload: never) => void;

const handlersByType = new Map<string, Set<Handler>>();

/** Subscribe to `type`; returns the `off` unsubscribe function. */
export function on<K extends keyof PlatformEventMap & string>(
  type: K,
  handler: (payload: PlatformEventMap[K]) => void,
): () => void {
  let handlers = handlersByType.get(type);
  if (!handlers) {
    handlers = new Set<Handler>();
    handlersByType.set(type, handlers);
  }
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
    if (handlers.size === 0) handlersByType.delete(type);
  };
}

/** Publish `payload` synchronously to current subscribers of `type`. */
export function emit<K extends keyof PlatformEventMap & string>(
  type: K,
  payload: PlatformEventMap[K],
): void {
  const handlers = handlersByType.get(type);
  if (!handlers) return;
  for (const handler of [...handlers]) handler(payload as never);
}
