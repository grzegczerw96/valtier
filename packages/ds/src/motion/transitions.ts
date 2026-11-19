/** Page loader + page transitions for a multi-page site.
 *
 *  First visit: the veil shows the logo filling from the bottom while fonts and
 *  above-the-fold media load (critically-damped spring, never < MIN_MS, never
 *  > MAX_MS), then a slanted wipe uncovers the page (.8s, power2.inOut).
 *  Internal link: a slanted panel wipes in from the left (.45s), the browser
 *  navigates, and the next page wipes the veil out (.7s after .14s).
 *  Phones use a skewed slab that translates across instead of a clip wipe. */
import { gsap } from './gsap';
import { isPhone, prefersReducedMotion } from './env';
import { liftVeil, isVeiled, veilHeld } from './veil';
import { sound } from './sound';

export const LOGO_H = 43;
const WIPE_END = 118;
const FLAG = 'v-transition';
export const VEIL_TIMING = { MIN_MS: 900, MAX_MS: 5000, HOLD_MAX_MS: 9000, IN: 0.45, OUT: 0.7, OUT_DELAY: 0.14, FIRST_OUT: 0.8, SLAB_IN: 420, SLAB_OUT: 560, FADE: 220 };

const wipeIn = (t: number) => `polygon(0 0, ${t}% 0, ${t - 18}% 100%, 0 100%)`;
const wipeOut = (t: number) => `polygon(${t}% 0, 100% 0, 100% 100%, ${t - 18}% 100%)`;
const SLAB_EASE = 'cubic-bezier(0.65, 0.05, 0.36, 1)';

function slab(el: HTMLElement, to: string, ms: number, done: () => void) {
  let fin = false;
  const end = () => {
    if (fin) return;
    fin = true;
    el.removeEventListener('transitionend', onEnd);
    done();
  };
  const onEnd = (e: TransitionEvent) => e.target === el && e.propertyName === 'translate' && end();
  el.addEventListener('transitionend', onEnd);
  el.style.transition = `translate ${ms}ms ${SLAB_EASE}`;
  el.style.setProperty('translate', `${to} 0`);
  setTimeout(end, ms + 120);
}
function slabJump(el: HTMLElement, to: string) {
  el.style.transition = 'none';
  el.style.setProperty('translate', `${to} 0`);
  void el.offsetWidth;
}

export function initTransitions(veil: HTMLElement) {
  const panel = veil.querySelector<HTMLElement>('.wipe-panel')!;
  const mark = veil.querySelector<HTMLElement>('[data-veil-mark]')!;
  const fill = veil.querySelector<SVGRectElement>('[data-logo-fill]');
  const pct = veil.querySelector<HTMLElement>('[data-veil-pct]');
  const reduced = prefersReducedMotion();
  let busy = false;

  const setFill = (b: number) => {
    if (!fill) return;
    const h = LOGO_H * b;
    fill.setAttribute('y', String(LOGO_H - h));
    fill.setAttribute('height', String(h));
    if (pct) pct.textContent = `${Math.round(b * 100)}%`;
  };
  const hide = () => {
    gsap.set(veil, { autoAlpha: 0, clipPath: 'none' });
    veil.removeAttribute('data-page-veil');
    document.documentElement.classList.remove('veil-on');
    busy = false;
  };

  /* ---- arrival ---------------------------------------------------------- */
  const fromTransition = (() => {
    try {
      const v = sessionStorage.getItem(FLAG);
      sessionStorage.removeItem(FLAG);
      return v === '1';
    } catch {
      return false;
    }
  })();

  const loaded = new Promise<void>((resolve) => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', () => resolve(), { once: true });
  });

  async function progress(minMs: number, maxMs: number, onTick?: (b: number) => void) {
    const t0 = performance.now();
    let fonts = 0;
    document.fonts?.ready.then(() => (fonts = 1));
    let isLoaded = document.readyState === 'complete';
    loaded.then(() => (isLoaded = true));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const near = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.top < 1.25 * innerHeight && r.bottom > 0 && r.width > 0;
    };
    // Lazy images never gate the loader: off-screen ones may never load at all.
    const imgs = Array.from(document.images).filter((i) => !i.complete && i.loading !== 'lazy' && near(i));
    let done = 0;
    const bump = () => (done += 1);
    imgs.forEach((i) => i.decode().then(bump, bump));
    // critically damped spring toward the real progress (omega = 4.44)
    let b = 0, v = 0, last = t0;
    await new Promise<void>((resolve) => {
      const step = () => {
        const now = performance.now();
        const held = veilHeld();
        const target = Math.min(held ? 0.92 : 1, 0.3 * fonts + 0.7 * (imgs.length ? done / imgs.length : isLoaded ? 1 : 0.5));
        const dt = Math.min(0.05, (now - last) / 1000) || 0.016;
        last = now;
        const w = 4.444444444444445, x = w * dt;
        const k = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
        const diff = b - target;
        const tmp = (v + w * diff) * dt;
        v = (v - w * tmp) * k;
        b = target + (diff + tmp) * k;
        onTick?.(b);
        const elapsed = now - t0;
        if ((isLoaded && !held && target >= 0.999 && b >= 0.99 && elapsed >= minMs) || elapsed >= (held ? Math.max(maxMs, VEIL_TIMING.HOLD_MAX_MS) : maxMs)) {
          onTick?.(1);
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  const reveal = (first: boolean) => {
    if (reduced) {
      liftVeil();
      gsap.to(veil, { autoAlpha: 0, duration: 0.15, onComplete: hide });
      return;
    }
    if (isPhone()) {
      mark.style.transition = 'opacity 150ms ease';
      mark.style.opacity = '0';
      slabJump(panel, '0%');
      setTimeout(() => {
        slab(panel, '100%', VEIL_TIMING.SLAB_OUT, () => {
          liftVeil();
          hide();
        });
      }, first ? 0 : VEIL_TIMING.OUT_DELAY * 1000);
      return;
    }
    const s = { t: 0 };
    gsap.to(s, {
      t: WIPE_END,
      duration: first ? VEIL_TIMING.FIRST_OUT : VEIL_TIMING.OUT,
      delay: first ? 0 : VEIL_TIMING.OUT_DELAY,
      ease: 'power2.inOut',
      onStart: () => sound.whoosh(),
      onUpdate: () => (veil.style.clipPath = wipeOut(s.t)),
      onComplete: () => {
        liftVeil();
        setFill(0);
        hide();
      },
    });
  };

  try { sessionStorage.setItem('v-seen', '1'); } catch {}
  if (!isVeiled()) {
    hide();
  } else if (fromTransition) {
    veil.setAttribute('data-page-veil', '');
    setFill(1);
    if (pct) pct.style.opacity = '0';
    progress(0, 2000).then(() => reveal(false));
  } else {
    veil.setAttribute('data-page-veil', '');
    progress(VEIL_TIMING.MIN_MS, VEIL_TIMING.MAX_MS, setFill).then(() => reveal(true));
  }

  // Back/forward cache: never resurrect a covering veil.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      liftVeil();
      hide();
      if (pct) pct.style.opacity = '';
    }
  });

  /* ---- departure -------------------------------------------------------- */
  const go = (href: string) => {
    try { sessionStorage.setItem(FLAG, '1'); } catch {}
    window.location.assign(href);
  };

  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if ((a.target && a.target !== '_self') || a.hasAttribute('download') || a.dataset.noTransition !== undefined) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.hash) return;
      e.preventDefault();
      // Same page: let the link's own handlers run (e.g. the menu closes).
      if (url.pathname + url.search === location.pathname + location.search) return;
      // Otherwise the wipe takes over: the open menu stays put underneath it.
      e.stopPropagation();
      if (busy) return;
      busy = true;
      veil.setAttribute('data-page-veil', '');
      document.documentElement.removeAttribute('data-veil-lifted');
      setFill(1);
      if (pct) pct.style.opacity = '0';
      sound.whoosh(0.5);
      if (reduced) return go(url.href);
      if (isPhone()) {
        slabJump(panel, '-100%');
        mark.style.opacity = '0';
        gsap.set(veil, { autoAlpha: 1, clipPath: 'none' });
        setTimeout(() => {
          mark.style.transition = 'opacity 220ms ease';
          mark.style.opacity = '1';
        }, 0.45 * VEIL_TIMING.SLAB_IN);
        slab(panel, '0%', VEIL_TIMING.SLAB_IN, () => go(url.href));
        return;
      }
      slabJump(panel, '0%');
      mark.style.opacity = '1';
      const s = { t: 0 };
      gsap.set(veil, { autoAlpha: 1, clipPath: wipeIn(0) });
      gsap.to(s, {
        t: WIPE_END,
        duration: VEIL_TIMING.IN,
        ease: 'power2.inOut',
        onUpdate: () => (veil.style.clipPath = wipeIn(s.t)),
        onComplete: () => go(url.href),
      });
    },
    true,
  );
}
