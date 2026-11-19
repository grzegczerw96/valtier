/** Pointer tilt for collectible cards (TiltCard). While the pointer is over the
 *  card it leans towards it (rx ±9°, ry ±13°), lifts 46px and grows 5%; the sheen
 *  follows the pointer across the face. Values are CSS variables so a timeline
 *  can take over the same card (e.g. when it flies away). */

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const TILT_VARS = ['--hover', '--mxf', '--rx', '--ry-cursor', '--tz', '--scale'] as const;

export function setVars(el: HTMLElement, vars: Record<string, string>) {
  for (const k in vars) el.style.setProperty(k, vars[k]);
}

export function attachTilt(el: HTMLElement, { lift = 46, grow = 1.05, rx = 9, ry = 13 } = {}) {
  const move = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const ny = clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2), -1, 1);
    const nx = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2), -1, 1);
    setVars(el, {
      '--hover': '1',
      '--mxf': String(clamp((e.clientX - r.left) / r.width, 0, 1)),
      '--ry-cursor': `${ry * nx}deg`,
      '--rx': `${-rx * ny}deg`,
      '--scale': String(grow),
      '--tz': `${lift}px`,
    });
  };
  const leave = () => setVars(el, { '--hover': '0', '--ry-cursor': '0deg', '--rx': '0deg', '--scale': '1', '--tz': '0px' });
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerleave', leave);
  return () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerleave', leave);
  };
}
