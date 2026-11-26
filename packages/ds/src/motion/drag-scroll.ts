/** Grab-to-scroll for a native horizontal scroller (overflow-x: auto): a mouse drag
 *  moves scrollLeft 1:1, release keeps the last frame's velocity and decays it by
 *  .94 per frame until it drops under .4 px. A click that ends a drag (> 6 px, within
 *  250 ms) is swallowed so tiles don't open by accident. Ticks follow drag speed.
 *  Touch keeps native scrolling; trackpads / shift+wheel scroll it horizontally. */
import { onHorizontalWheel } from './drift';
import { sound } from './sound';

export interface DragScroll { moved: () => number; destroy: () => void }

export function initDragScroll(el: HTMLElement): DragScroll {
  let down = false, x = 0, moved = 0, endedAt = -Infinity, v = 0, raf = 0;
  const glide = () => {
    v *= 0.94;
    if (Math.abs(v) < 0.4) return;
    el.scrollLeft -= v;
    raf = requestAnimationFrame(glide);
  };
  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    cancelAnimationFrame(raf);
    down = true; x = e.clientX; moved = 0; endedAt = -Infinity; v = 0;
  };
  const onMove = (e: PointerEvent) => {
    if (!down) return;
    const dx = e.clientX - x;
    x = e.clientX;
    moved += Math.abs(dx);
    v = dx;
    el.scrollLeft -= dx;
    if (moved > 6 && !el.hasPointerCapture(e.pointerId)) el.setPointerCapture(e.pointerId);
    if (Math.abs(dx) > 6) sound.tick(Math.min(1, Math.abs(dx) / 28));
  };
  const onUp = () => {
    if (!down) return;
    down = false;
    endedAt = performance.now();
    raf = requestAnimationFrame(glide);
  };
  const onCancel = () => { down = false; endedAt = performance.now(); };
  const onClick = (e: MouseEvent) => {
    if (moved > 6 && performance.now() - endedAt < 250) { e.preventDefault(); e.stopPropagation(); }
  };
  const noDrag = (e: DragEvent) => e.preventDefault();
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);
  el.addEventListener('click', onClick, true);
  el.addEventListener('dragstart', noDrag);
  const offWheel = onHorizontalWheel(el, (dx) => {
    if (el.scrollWidth <= el.clientWidth) return false;
    cancelAnimationFrame(raf);
    el.scrollLeft += dx;
  });
  return {
    moved: () => moved,
    destroy() {
      cancelAnimationFrame(raf);
      offWheel();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('click', onClick, true);
      el.removeEventListener('dragstart', noDrag);
    },
  };
}
