/** Touch carousel built on native scroll-snap. Marks the centred item with
 *  aria-current="true" (CSS animates the active state), supports arrow keys and
 *  an optional infinite loop (items are rendered in 3 copies; the scroll
 *  position is silently re-centred on the middle copy when it drifts out). */
import { onHorizontalWheel } from './drift';
import { prefersReducedMotion } from './env';

export interface SnapRail {
  goTo: (i: number) => void;
  active: () => number;
  destroy: () => void;
}

export function initSnapRail(
  list: HTMLElement,
  { loop = false, hideInactive = false, onActive }: { loop?: boolean; hideInactive?: boolean; onActive?: (i: number) => void } = {},
): SnapRail {
  const items = () => Array.from(list.children) as HTMLElement[];
  const copies = loop ? 3 : 1;
  const count = items().length / copies;
  const mid = (copies - 1) / 2;
  let active = -1;
  let current = -1;
  let settle = 0;

  const step = () => {
    const [a, b] = items();
    return a && b ? b.getBoundingClientRect().left - a.getBoundingClientRect().left : a?.offsetWidth ?? 1;
  };
  const offsetOf = (i: number) => {
    const first = items()[0];
    if (!first) return 0;
    const lr = list.getBoundingClientRect();
    return first.getBoundingClientRect().left - lr.left + list.scrollLeft + first.offsetWidth / 2 - list.clientWidth / 2 + i * step();
  };
  const jump = (left: number) => {
    const sb = list.style.scrollBehavior;
    list.style.scrollBehavior = 'auto';
    list.scrollLeft = left;
    list.style.scrollBehavior = sb;
  };
  const recentre = () => {
    if (!loop) return;
    const s = step(), span = s * count;
    const idx = Math.round((list.scrollLeft - offsetOf(0)) / s);
    const block = Math.floor(idx / count);
    if (block !== mid) jump(list.scrollLeft + (mid - block) * span);
  };
  const sync = () => {
    const s = step();
    const raw = Math.max(0, Math.min(items().length - 1, Math.round((list.scrollLeft - offsetOf(0)) / s)));
    const logical = ((raw % count) + count) % count;
    if (raw !== current) {
      items()[current]?.removeAttribute('aria-current');
      items()[raw]?.setAttribute('aria-current', 'true');
      if (hideInactive) items().forEach((el, i) => el.toggleAttribute('inert', i !== raw));
      current = raw;
    }
    if (logical !== active) {
      active = logical;
      onActive?.(logical);
    }
  };
  const onScroll = () => {
    sync();
    if (!loop) return;
    clearTimeout(settle);
    settle = window.setTimeout(recentre, 150);
  };

  if (loop) {
    items().forEach((el, i) => {
      if (Math.floor(i / count) !== mid) {
        el.setAttribute('aria-hidden', 'true');
        el.querySelectorAll<HTMLElement>('a, button').forEach((f) => (f.tabIndex = -1));
      }
    });
    jump(offsetOf(mid * count));
  }
  sync();
  list.addEventListener('scroll', onScroll, { passive: true });
  list.addEventListener('scrollend', recentre);
  const offWheel = onHorizontalWheel(list, (dx) => {
    if (list.scrollWidth <= list.clientWidth) return false;
    list.style.scrollSnapType = 'none';
    list.scrollLeft += dx;
    clearTimeout(settle);
    settle = window.setTimeout(() => {
      list.style.scrollSnapType = '';
      recentre();
    }, 160);
  });
  const goTo = (i: number) => {
    const target = loop ? mid * count + i : i;
    list.scrollTo({ left: offsetOf(target), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
  list.addEventListener('keydown', (e) => {
    if (e.target !== list) return;
    const k = e.key === 'ArrowRight' ? active + 1 : e.key === 'ArrowLeft' ? active - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? count - 1 : null;
    if (k === null) return;
    e.preventDefault();
    goTo(loop ? (k + count) % count : Math.max(0, Math.min(count - 1, k)));
  });
  // Vertical swipes should scroll the page, not fight the rail.
  let sx = 0, sy = 0, decided = false, locked = false;
  list.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (t) { sx = t.clientX; sy = t.clientY; decided = false; }
  }, { passive: true });
  list.addEventListener('touchmove', (e) => {
    if (decided) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = Math.abs(t.clientX - sx), dy = Math.abs(t.clientY - sy);
    if (Math.max(dx, dy) < 6) return;
    decided = true;
    if (dy > dx) { locked = true; list.style.overflowX = 'hidden'; }
  }, { passive: true });
  const release = () => { decided = false; if (locked) { locked = false; list.style.overflowX = ''; } };
  list.addEventListener('touchend', release, { passive: true });
  list.addEventListener('touchcancel', release, { passive: true });
  const ro = new ResizeObserver(() => { sync(); recentre(); });
  ro.observe(list);

  return {
    goTo,
    active: () => active,
    destroy: () => {
      list.removeEventListener('scroll', onScroll);
      list.removeEventListener('scrollend', recentre);
      offWheel();
      ro.disconnect();
    },
  };
}
