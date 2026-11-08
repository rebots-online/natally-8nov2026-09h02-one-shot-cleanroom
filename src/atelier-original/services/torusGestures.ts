export function getTorusZoomDistance(distance: number, factor: number): number {
  const current = Number.isFinite(distance) && distance > 0 ? distance : Math.hypot(5.8, 5.2);
  const scale = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return Math.max(4, Math.min(13, current * scale));
}

export function bindTorusTouch(element: HTMLElement, callbacks: {
  start: (x: number, y: number) => void;
  move: (x: number, y: number) => void;
  end: (allowMomentum: boolean) => void;
  zoom: (factor: number) => void;
}) {
  let previousDistance = 0;
  let moved = false;
  let lastTouchAt = -Infinity;
  let origin: { x: number; y: number } | null = null;
  let mode = 0;
  let rotated = false;
  const separation = (touches: TouchList) => Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY,
  );
  const resetBaseline = (event: TouchEvent) => {
    lastTouchAt = Date.now();
    const touches = event.targetTouches;
    callbacks.end(event.type === 'touchend' && mode === 1 && touches.length === 0 && rotated);
    mode = touches.length;
    rotated = false;
    previousDistance = mode === 2 ? separation(touches) : 0;
    if (mode === 1) {
      origin = { x: touches[0].clientX, y: touches[0].clientY };
      callbacks.start(origin.x, origin.y);
    } else {
      origin = null;
    }
    if (mode >= 2) {
      moved = true;
      if (event.cancelable) event.preventDefault();
    }
  };
  const onStart = (event: TouchEvent) => {
    if (mode === 0) moved = false;
    resetBaseline(event);
  };
  const onMove = (event: TouchEvent) => {
    if (mode === 0) return;
    if (event.cancelable) event.preventDefault();
    const touches = event.targetTouches;
    if (touches.length !== mode) {
      resetBaseline(event);
      return;
    }
    if (mode === 2) {
      const distance = separation(touches);
      if (previousDistance > 0 && distance > 0) callbacks.zoom(previousDistance / distance);
      previousDistance = distance;
    } else if (mode === 1 && origin) {
      const touch = touches[0];
      if (Math.hypot(touch.clientX - origin.x, touch.clientY - origin.y) > 4) {
        moved = true;
        rotated = true;
      }
      callbacks.move(touch.clientX, touch.clientY);
    }
  };
  const onCancel = () => {
    lastTouchAt = Date.now();
    callbacks.end(false);
    mode = 0;
    rotated = false;
    origin = null;
    previousDistance = 0;
    moved = true;
  };
  element.addEventListener('touchstart', onStart, { passive: false });
  element.addEventListener('touchmove', onMove, { passive: false });
  element.addEventListener('touchend', resetBaseline);
  element.addEventListener('touchcancel', onCancel);
  return {
    suppressClick: () => moved && Date.now() - lastTouchAt < 700,
    suppressMouse: () => mode > 0 || Date.now() - lastTouchAt < 700,
    dispose: () => {
      element.removeEventListener('touchstart', onStart);
      element.removeEventListener('touchmove', onMove);
      element.removeEventListener('touchend', resetBaseline);
      element.removeEventListener('touchcancel', onCancel);
      onCancel();
    },
  };
}
