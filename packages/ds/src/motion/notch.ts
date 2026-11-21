/** "File tab" card outline: a rounded card whose top edge steps down after a tab
 *  on the left (the tab holds a logo lock-up). Used by the Journal detail card;
 *  the tab can grow to fit its contents (animate `flatEnd`).
 *
 *    ┌──────────╮
 *    │   tab     ╲___________________
 *    │                               │
 *    │                               │
 *    └───────────────────────────────┘
 */
export const NOTCH = { radius: 16, slope: 59.506, drop: 51, flatEnd: 214.289 } as const;

/** Tab width for a lock-up of `w` px placed 37px in from the card edge (+32 air). */
export const notchTabEnd = (w: number) => 37 + w + 32;

export function notchPath(w: number, h: number, flatEnd: number = NOTCH.flatEnd) {
  const r = NOTCH.radius, k = 7.1632, drop = NOTCH.drop;
  const f = Math.max(24, Math.min(flatEnd, w - NOTCH.slope - r - 8));
  const a = (v: number) => +(f + v).toFixed(3);
  const n = (v: number) => +v.toFixed(3);
  return [
    `M${r} 0`,
    `L${a(0)} 0`,
    `C${a(4.585)} 0 ${a(8.95)} 1.96737 ${a(11.987)} 5.40298`,
    `L${a(47.518)} 45.5969`,
    `C${a(50.555)} 49.0325 ${a(54.92)} ${drop} ${a(NOTCH.slope)} ${drop}`,
    `L${n(w - r)} ${drop}`,
    `C${n(w - k)} ${drop} ${w} 58.163 ${w} 67`,
    `L${w} ${n(h - r)}`,
    `C${w} ${n(h - k)} ${n(w - k)} ${h} ${n(w - r)} ${h}`,
    `L${r} ${h}`,
    `C${k} ${h} 0 ${n(h - k)} 0 ${n(h - r)}`,
    `L0 ${r}`,
    `C0 ${k} ${k} 0 ${r} 0Z`,
  ].join(' ');
}
