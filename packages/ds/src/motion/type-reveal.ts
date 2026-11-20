/** TypeReveal — a paragraph that types itself in once it scrolls into place.
 *  Markup comes from TypeReveal.astro: every character is a [data-tr-char] span
 *  (opacity 0); the next character to appear is drawn as a solid block cursor
 *  (background currentColor, transparent text). ~55 chars/s with a little jitter.
 *  Starts when the paragraph's top passes `startAt` of the viewport height. */
import { prefersReducedMotion } from './env';
import { isPast } from './inview';

export function initTypeReveal(root: HTMLElement, { cps = 55, startAt = 0.82 } = {}) {
  if ((root as any)._tr) return (root as any)._tr as () => void;
  const chars = Array.from(root.querySelectorAll<HTMLElement>('[data-tr-char]'));
  const show = (c: HTMLElement) => {
    c.style.backgroundColor = '';
    c.style.color = '';
    c.style.opacity = '1';
  };
  if (!chars.length) return () => {};
  if (prefersReducedMotion()) {
    chars.forEach(show);
    return () => {};
  }
  let started = false, raf = 0, wait = 0;
  const cursor = (c: HTMLElement) => {
    c.style.backgroundColor = 'currentcolor';
    c.style.color = 'transparent';
  };
  const type = () => {
    started = true;
    const step = 1000 / cps;
    let i = 0, acc = 0, last = performance.now();
    cursor(chars[0]);
    const tick = (now: number) => {
      acc += (now - last) / step;
      last = now;
      while (acc >= 1 && i < chars.length) {
        acc -= 1 + (Math.random() - 0.5) * 0.7;
        const c = chars[i];
        show(c);
        if (++i < chars.length) cursor(chars[i]);
      }
      if (i < chars.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  const poll = () => {
    if (started) return;
    if (isPast(root, startAt)) {
      io.disconnect();
      type();
      return;
    }
    wait = requestAnimationFrame(poll);
  };
  const io = new IntersectionObserver(([e]) => {
    cancelAnimationFrame(wait);
    if (e?.isIntersecting && !started) wait = requestAnimationFrame(poll);
  }, { threshold: 0.05 });
  io.observe(root);
  const off = () => {
    io.disconnect();
    cancelAnimationFrame(raf);
    cancelAnimationFrame(wait);
  };
  (root as any)._tr = off;
  return off;
}

export function initAllTypeReveals(scope: ParentNode = document) {
  scope.querySelectorAll<HTMLElement>('[data-type-reveal]').forEach((el) =>
    initTypeReveal(el, { cps: parseFloat(el.dataset.cps || '55'), startAt: parseFloat(el.dataset.start || '0.82') }),
  );
}
