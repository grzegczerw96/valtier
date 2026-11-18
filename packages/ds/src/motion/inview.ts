import { ScrollTrigger } from './gsap';

/** True when the element's top has crossed `ratio` of the viewport height
 *  (or the page is scrolled to the very bottom, so late items still play). */
export function isPast(el: Element | null, ratio: number) {
  if (!el) return true;
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  if (r.bottom <= 0 || r.top >= vh) return false;
  return r.top <= vh * ratio || window.scrollY >= ScrollTrigger.maxScroll(window) - 64;
}

/** Plays `onReveal` once when `el` passes `ratio`: via a ScrollTrigger and,
 *  after two frames, an immediate check (for elements already in view at load). */
export function revealOnce(el: Element, ratio: number, onReveal: () => void, startOverride?: () => number) {
  let done = false;
  // ScrollTrigger may call onEnter synchronously while being created (element
  // already past the start), so the instance is declared up front.
  let st: ScrollTrigger | null = null;
  const fire = () => {
    if (done || !isPast(el, ratio)) return;
    done = true;
    onReveal();
    st?.kill();
  };
  st = ScrollTrigger.create({
    trigger: el,
    start: startOverride ?? `top ${Math.round(ratio * 100)}%`,
    onEnter: fire,
    onEnterBack: fire,
  });
  if (done) st.kill();
  let raf = requestAnimationFrame(() => {
    raf = requestAnimationFrame(() => {
      if (done || !st) return;
      st.refresh();
      if (st.progress > 0 || isPast(el, ratio)) fire();
    });
  });
  return () => {
    cancelAnimationFrame(raf);
    st?.kill();
  };
}

export { deferInit } from './schedule';

/** Defers `fn` until `el` is within `margin` of the viewport (lazy section init). */
export function whenNear(el: Element, fn: () => void, margin = '120% 0px') {
  const io = new IntersectionObserver(([e]) => {
    if (!e?.isIntersecting) return;
    io.disconnect();
    fn();
  }, { rootMargin: margin });
  io.observe(el);
  return () => io.disconnect();
}

/** Runs `onChange(visible)` as the element enters/leaves an expanded viewport. */
export function watchVisibility(el: Element, onChange: (v: boolean) => void, rootMargin = '15% 0px') {
  const io = new IntersectionObserver(([e]) => onChange(!!e?.isIntersecting), { rootMargin });
  io.observe(el);
  return () => io.disconnect();
}
