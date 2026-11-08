// Interactive three.js natal-chart renderer. Scene construction, disposal,
// and picking live in ./scene (pure three.js); this component owns the canvas
// element, pointer/wheel input, resize observation, and the render loop.

import { useEffect, useRef } from 'react';
import type { ChartBodyKey, NatalChart } from '../shared/types';
import { createChartScene } from './scene';
import type { ChartScene } from './scene';

export interface AstroChartProps {
  chart: NatalChart;
  /** Fires with the hovered body's key, or null when nothing is hovered. */
  onHoverBody?: (key: ChartBodyKey | null) => void;
}

export function AstroChart({ chart, onHoverBody }: AstroChartProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hoverCallbackRef = useRef<AstroChartProps['onHoverBody']>(undefined);

  useEffect(() => {
    hoverCallbackRef.current = onHoverBody;
  }, [onHoverBody]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let scene: ChartScene;
    try {
      scene = createChartScene(canvas, chart);
    } catch {
      // WebGL unavailable: leave the canvas blank rather than crash the app.
      return;
    }

    scene.resize(host.clientWidth, host.clientHeight);
    const resizeObserver = new ResizeObserver(entries => {
      const box = entries[entries.length - 1]?.contentRect;
      if (box) scene.resize(box.width, box.height);
    });
    resizeObserver.observe(host);

    let frame = 0;
    let lastFrameAt = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(Math.max((now - lastFrameAt) / 1000, 0), 0.05);
      lastFrameAt = now;
      scene.update(delta);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    // Redraw canvas text once Playfair Display has actually loaded.
    let labelsWanted = true;
    document.fonts.ready
      .then(() => {
        if (labelsWanted) scene.refreshLabels();
      })
      .catch(() => undefined);

    let hovered: ChartBodyKey | null = null;
    const setHovered = (key: ChartBodyKey | null) => {
      if (hovered === key) return;
      hovered = key;
      scene.setHover(key);
      canvas.style.cursor = key ? 'pointer' : 'grab';
      hoverCallbackRef.current?.(key);
    };

    let dragging = false;
    let dragPointerId = -1;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      dragPointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Pointer already gone; drag simply ends early.
      }
      canvas.style.cursor = 'grabbing';
    };

    const onPointerMove = (event: PointerEvent) => {
      if (dragging) {
        if (event.pointerId !== dragPointerId) return;
        scene.spinBy(event.clientX - lastX, event.clientY - lastY);
        lastX = event.clientX;
        lastY = event.clientY;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      setHovered(scene.pickAt(ndcX, ndcY));
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== dragPointerId) return;
      dragging = false;
      dragPointerId = -1;
      if (canvas.hasPointerCapture(event.pointerId)) {
        try {
          canvas.releasePointerCapture(event.pointerId);
        } catch {
          // Already released.
        }
      }
      canvas.style.cursor = hovered ? 'pointer' : 'grab';
    };

    const onPointerLeave = () => {
      setHovered(null);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      scene.zoomBy(event.deltaY);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      labelsWanted = false;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      scene.dispose();
      canvas.style.cursor = '';
    };
  }, [chart]);

  const ariaLabel = chart.input.name ? `Natal chart for ${chart.input.name}` : 'Natal chart';

  return (
    <div
      ref={hostRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '280px',
        overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: 'grab',
        }}
      />
    </div>
  );
}
