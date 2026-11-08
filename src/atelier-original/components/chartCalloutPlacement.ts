type Point = { x: number; y: number };
type Band = { left: number; top: number; right: number; bottom: number; side: 'left' | 'right' | 'above' | 'below' };

// Coordinates and measured sizes are viewport pixels, independent of pane transforms.
export function placeChartCallout(card: HTMLDivElement, pointer: Point, inset: DOMRect | null): boolean {
  const viewport = window.visualViewport;
  const left = (viewport?.offsetLeft ?? 0) + 8;
  const top = (viewport?.offsetTop ?? 0) + 8;
  const right = (viewport?.offsetLeft ?? 0) + (viewport?.width ?? document.documentElement.clientWidth) - 8;
  const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? document.documentElement.clientHeight) - 8;
  card.style.visibility = 'hidden';
  card.style.transform = 'none';
  const show = (x: number, y: number) => {
    card.style.left = `${x}px`;card.style.top = `${y}px`;
    card.style.visibility = 'visible';card.style.opacity = '1';
    return true;
  };
  if (!inset) {
    card.style.width = `${Math.min(320, Math.max(0, right - left))}px`;
    const size = card.getBoundingClientRect();
    if (size.width > right - left || size.height > bottom - top) return false;
    const x = Math.max(left, Math.min(right - size.width, pointer.x - size.width / 2));
    const above = pointer.y - size.height - 12;
    return show(x, above >= top ? above : Math.max(top, Math.min(bottom - size.height, pointer.y + 12)));
  }
  const sides: Band[] = [
    { left: Math.max(left, inset.right + 12), top, right, bottom, side: 'right' },
    { left, top, right: Math.min(right, inset.left - 12), bottom, side: 'left' },
  ];
  sides.sort((a, b) => (b.right - b.left) - (a.right - a.left));
  const vertical: Band[] = [
    { left, top: Math.max(top, inset.bottom + 12), right, bottom, side: 'below' },
    { left, top, right, bottom: Math.min(bottom, inset.top - 12), side: 'above' },
  ];
  vertical.sort((a, b) => (b.bottom - b.top) - (a.bottom - a.top));
  for (const band of [...sides, ...vertical]) {
    const width = Math.floor(band.right - band.left), height = band.bottom - band.top;
    if (width < 180 || height <= 0) continue;
    // Try the familiar card width, then the available band if wrapping needs more room.
    for (const candidateWidth of [...new Set([Math.min(320, width), width])]) {
      card.style.width = `${candidateWidth}px`;
      const size = card.getBoundingClientRect();
      if (size.width > width || size.height > height) continue;
      const x = band.side === 'right' ? band.left : band.side === 'left' ? band.right - size.width
        : Math.max(band.left, Math.min(band.right - size.width, pointer.x - size.width / 2));
      const y = band.side === 'below' ? band.top : band.side === 'above' ? band.bottom - size.height
        : Math.max(band.top, Math.min(band.bottom - size.height, pointer.y - size.height / 2));
      return show(x, y);
    }
  }
  return false;
}
