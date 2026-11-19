/** Slanted wipe geometry shared by pinned scenes that tilt a pane away.
 *
 *  A pane of height `pane` lifts by `1.2 · t · pane` on its left edge and
 *  `1.8 · t · pane` on its right, so the cut line rises and steepens as t → 1.
 *  slantClip() returns the part of a `w × h` box (top-left at the viewport top)
 *  that lies above (`above = true`) or below that line, as a px polygon. */

export const SLANT = { left: 1.2, right: 1.8 } as const;

export function slantClip(t: number, w: number, h: number, pane: number, above: boolean) {
  const yl = pane * (1 - SLANT.left * t), yr = pane * (1 - SLANT.right * t);
  const f = (x: number, y: number) => y - (yl + ((yr - yl) * x) / w);
  const inside = (x: number, y: number) => (above ? f(x, y) <= 0 : f(x, y) >= 0);
  const box: [number, number][] = [[0, 0], [w, 0], [w, h], [0, h]];
  const out: [number, number][] = [];
  for (let i = 0; i < box.length; i++) {
    const [x1, y1] = box[i], [x2, y2] = box[(i + 1) % box.length];
    const a = inside(x1, y1);
    if (a) out.push([x1, y1]);
    if (a !== inside(x2, y2)) {
      const d1 = f(x1, y1), k = d1 / (d1 - f(x2, y2));
      out.push([x1 + k * (x2 - x1), y1 + k * (y2 - y1)]);
    }
  }
  return out.length < 3 ? 'polygon(0 0, 0 0, 0 0)' : `polygon(${out.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')})`;
}

/** Angle of the cut line in radians (negative: rising to the right). */
export const slantAngle = (t: number, w: number, pane: number) => Math.atan2(-(SLANT.right - SLANT.left) * t * pane, w);
