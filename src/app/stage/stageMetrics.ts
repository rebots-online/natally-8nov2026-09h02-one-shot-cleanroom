// Stage measurements for the inset layer (DOCS/ARCHITECTURE.md §Chart
// inset). The floating inset measures its own host layer; this hook feeds
// the focused (chart view) height — the verbatim stage's visual area — so
// the wheel fills exactly the room it replaces when the view swaps.

import { useEffect, useState } from 'react';

/**
 * Height of the stage's visual area (`.reading-stage__visual` inside the
 * given root), kept live through ResizeObserver. Null until measured.
 */
export function useStageVisualHeight(
  root: React.RefObject<HTMLElement | null>,
): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const element = root.current;
    if (element === null) return;
    const visual = element.querySelector('.reading-stage__visual');
    if (visual === null) return;
    const observer = new ResizeObserver(entries => {
      const box = entries[entries.length - 1];
      if (box !== undefined && box.contentRect.height > 0) {
        setHeight(box.contentRect.height);
      }
    });
    observer.observe(visual);
    return () => observer.disconnect();
  }, [root]);

  return height;
}
