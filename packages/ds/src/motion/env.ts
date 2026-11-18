/** Shared environment queries. The phone query is the single breakpoint used by
 *  CSS (tokens.css) and JS alike, so layout and behaviour never disagree. */
export const PHONE_QUERY = '(max-width: 767px), (max-width: 900px) and (pointer: coarse)';

const mq = (q: string) => (typeof window === 'undefined' ? null : window.matchMedia(q));

export const isPhone = () => !!mq(PHONE_QUERY)?.matches;
export const prefersReducedMotion = () => !!mq('(prefers-reduced-motion: reduce)')?.matches;
export const hasFinePointer = () => !!mq('(hover: hover) and (pointer: fine)')?.matches;
export const hasHover = () => !mq('(hover: none)')?.matches;

/** Calls `fn` whenever the phone/desktop layout flips. Returns an unsubscribe. */
export function onLayoutChange(fn: (phone: boolean) => void) {
  const m = mq(PHONE_QUERY);
  if (!m) return () => {};
  const h = () => fn(m.matches);
  m.addEventListener('change', h);
  return () => m.removeEventListener('change', h);
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mixInt = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
// Intl.NumberFormat is expensive to construct; counters call this every frame.
const formatters = new Map<number, Intl.NumberFormat>();
export const fmt = (n: number, decimals = 0) => {
  let f = formatters.get(decimals);
  if (!f) formatters.set(decimals, (f = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })));
  return f.format(n);
};

/** Page geometry helpers mirroring the CSS custom properties. */
export const CONTENT_MAX = 1728;
export const pageX = (w = window.innerWidth) => Math.max(0, (w - CONTENT_MAX) / 2);
export const vu = (w = window.innerWidth, h = window.innerHeight) => Math.min(Math.min(w, CONTENT_MAX) / 100, (1.8 * h) / 100);

/** Cubic-bezier easing as a plain function (used where GSAP strings can't express it). */
export function bezier([x1, y1, x2, y2]: [number, number, number, number]) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = sx(t) - x;
      if (Math.abs(d) < 1e-7) return sy(t);
      const dd = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(dd) < 1e-7) break;
      const n = t - d / dd;
      if (n < 0 || n > 1) break;
      t = n;
    }
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) {
      t = (lo + hi) / 2;
      const d = sx(t) - x;
      if (Math.abs(d) < 1e-7) break;
      d < 0 ? (lo = t) : (hi = t);
    }
    return sy(t);
  };
}

export const EASE = {
  editorial: bezier([0.65, 0.05, 0.36, 1]),
  ui: bezier([0.4, 0, 0.2, 1]),
  cover: bezier([0.85, 0, 0.15, 1]),
  reveal: bezier([0.16, 1, 0.3, 1]),
};
