/** Smooth scrolling (Lenis) + ScrollTrigger plumbing.
 *  Lenis runs on desktop only (no phone, no reduced motion), exactly like the
 *  reference: lerp .16, wheel x.72, touch x1.5, driven from GSAP's ticker. */
import type Lenis from 'lenis';
import { gsap, ScrollTrigger } from './gsap';
import { isPhone, prefersReducedMotion } from './env';

export const SCROLL = { lerp: 0.16, wheelMultiplier: 0.72, touchMultiplier: 1.5 } as const;

let lenis: Lenis | null = null;
let locked = false;

export async function initSmoothScroll() {
  scheduleRefreshes();
  if (isPhone() || prefersReducedMotion()) return null;
  const { default: LenisCtor } = await import('lenis');
  if (isPhone()) return null;
  lenis = new LenisCtor({
    lerp: SCROLL.lerp,
    wheelMultiplier: SCROLL.wheelMultiplier,
    touchMultiplier: SCROLL.touchMultiplier,
    smoothWheel: true,
    syncTouch: false,
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    prevent: (node: HTMLElement) => node.hasAttribute('data-lenis-prevent'),
  });
  if (locked) lenis.stop();
  gsap.ticker.add((t) => lenis?.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.on('scroll', ScrollTrigger.update);
  ScrollTrigger.refresh();
  return lenis;
}

export const getLenis = () => lenis;

/** Freeze page scroll (menu, dialogs). */
export function lockScroll() {
  locked = true;
  lenis?.stop();
  document.documentElement.style.overflow = 'hidden';
}
export function unlockScroll() {
  locked = false;
  lenis?.start();
  document.documentElement.style.overflow = '';
}
export const isScrollLocked = () => locked;

/** Scales wheel/touch sensitivity, e.g. 0.8 while an object flies through a pinned scene. */
export function setScrollScale(k: number) {
  const vs = (lenis as unknown as { virtualScroll?: { options: Record<string, number> } })?.virtualScroll;
  if (!vs) return;
  vs.options.wheelMultiplier = SCROLL.wheelMultiplier * k;
  vs.options.touchMultiplier = SCROLL.touchMultiplier * k;
}

export function scrollToY(y: number, opts: { duration?: number; immediate?: boolean } = {}) {
  if (lenis) return lenis.scrollTo(y, { duration: opts.duration ?? 0.8, immediate: opts.immediate, force: opts.immediate });
  window.scrollTo({ top: y, behavior: opts.immediate || prefersReducedMotion() ? 'instant' : 'smooth' });
}

/* ---- Debounced ScrollTrigger.refresh ----------------------------------------
   Never synchronous: any number of calls inside the window collapse into ONE
   refresh, run once scrolling has been idle (a refresh forces full layout). */
let lastScroll = 0;
let listening = false;
let refreshTimer = 0;
export function refreshWhenIdle(idleMs = 200) {
  if (!listening) {
    listening = true;
    window.addEventListener('scroll', () => (lastScroll = performance.now()), { passive: true, capture: true });
  }
  clearTimeout(refreshTimer);
  const tick = () => {
    if (performance.now() - lastScroll < idleMs) {
      refreshTimer = window.setTimeout(tick, idleMs);
      return;
    }
    ScrollTrigger.refresh();
  };
  refreshTimer = window.setTimeout(tick, idleMs);
}

function scheduleRefreshes() {
  // ScrollTrigger refreshes on DOMContentLoaded/load itself; we only follow late
  // layout changes (web fonts, decoded images) with coalesced refreshes.
  document.fonts?.ready.then(() => refreshWhenIdle());
  document.fonts?.addEventListener('loadingdone', () => refreshWhenIdle());
  [600, 1800].forEach((ms) => setTimeout(() => refreshWhenIdle(), ms));
  // Re-measure when the document height changes noticeably (images, fonts, embeds).
  let h = document.documentElement.scrollHeight;
  let t = 0;
  new ResizeObserver(() => {
    const nh = document.documentElement.scrollHeight;
    if (Math.abs(nh - h) < 24) return;
    h = nh;
    clearTimeout(t);
    t = window.setTimeout(() => refreshWhenIdle(), 220);
  }).observe(document.body);
}
