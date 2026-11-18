/** Full-screen menu + morphing hamburger (two parallelograms -> X).
 *  Each vertex rotates around its shape's centroid while it interpolates, so the
 *  bars swing instead of sliding; .45s, editorial ease. */
import { gsap } from './gsap';
import { EASE, prefersReducedMotion } from './env';
import { lockScroll, unlockScroll } from './scroll';

type Pt = [number, number];
const TOP_CLOSED: Pt[] = [[8.54, 0], [29.9, 0], [27.01, 4.04], [5.66, 4.04]];
const TOP_OPEN: Pt[] = [[5, -0.46], [18.65, 13.03], [24.02, 12.98], [10.38, -0.5]];
const BOT_CLOSED: Pt[] = [[2.89, 8.89], [24.24, 8.89], [21.35, 12.93], [0, 12.93]];
const BOT_OPEN: Pt[] = [[10.38, 13.03], [24.02, -0.46], [18.65, -0.5], [5, 12.98]];

const path = (pts: Pt[]) => 'M' + pts.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join(' L') + ' Z';
const centroid = (pts: Pt[]): Pt => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

function morph(a: Pt[], b: Pt[], t: number) {
  const [ax, ay] = centroid(a);
  const [bx, by] = centroid(b);
  const cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t;
  return path(
    a.map((p, i) => {
      const q = b[i];
      const dx = p[0] - ax, dy = p[1] - ay, ex = q[0] - bx, ey = q[1] - by;
      const r1 = Math.hypot(dx, dy), r2 = Math.hypot(ex, ey);
      let da = Math.atan2(ey, ex) - Math.atan2(dy, dx);
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      const r = r1 + (r2 - r1) * t;
      const ang = Math.atan2(dy, dx) + da * t;
      return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)] as Pt;
    }),
  );
}

export const HAMBURGER = { top: path(TOP_CLOSED), bot: path(BOT_CLOSED) };

let open = false;
const subs = new Set<(o: boolean) => void>();
export const isMenuOpen = () => open;
export const onMenu = (fn: (o: boolean) => void) => (subs.add(fn), () => subs.delete(fn));
export function setMenu(v: boolean) {
  if (open === v) return;
  open = v;
  subs.forEach((f) => f(v));
}

export function initMenu(root: HTMLElement) {
  const btn = root.querySelector<HTMLButtonElement>('[data-hamburger]');
  const panel = root.querySelector<HTMLElement>('#site-navigation');
  const top = btn?.querySelector<SVGPathElement>('.hamburger-bar--top');
  const bot = btn?.querySelector<SVGPathElement>('.hamburger-bar--bot');
  if (!btn || !panel || !top || !bot) return;
  const st = { p: 0 };
  let restoreFocus: HTMLElement | null = null;

  btn.addEventListener('click', () => setMenu(!open));
  panel.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));

  const focusables = () =>
    Array.from(root.querySelectorAll<HTMLElement>('a[href], button')).filter((el) => el.getClientRects().length && !el.closest('[inert]'));

  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setMenu(false);
      return;
    }
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onKey, true);

  onMenu((o) => {
    gsap.to(st, {
      p: o ? 1 : 0,
      duration: prefersReducedMotion() ? 0 : 0.45,
      ease: EASE.editorial,
      overwrite: true,
      onUpdate: () => {
        top.setAttribute('d', morph(TOP_CLOSED, TOP_OPEN, st.p));
        bot.setAttribute('d', morph(BOT_CLOSED, BOT_OPEN, st.p));
      },
    });
    btn.setAttribute('aria-expanded', String(o));
    btn.setAttribute('aria-label', o ? 'Close menu' : 'Open menu');
    btn.dataset.state = o ? 'open' : 'closed';
    panel.toggleAttribute('inert', !o);
    panel.setAttribute('aria-hidden', String(!o));
    panel.dataset.open = String(o);
    document.body.classList.toggle('menu-open', o);
    root.setAttribute('role', o ? 'dialog' : '');
    if (o) {
      root.setAttribute('aria-modal', 'true');
      restoreFocus = document.activeElement as HTMLElement;
      lockScroll();
      requestAnimationFrame(() => (panel.querySelector<HTMLElement>('a[aria-current="page"]') ?? panel.querySelector<HTMLElement>('a'))?.focus({ preventScroll: true }));
    } else {
      root.removeAttribute('aria-modal');
      root.removeAttribute('role');
      unlockScroll();
      restoreFocus?.focus({ preventScroll: true });
    }
  });
}
