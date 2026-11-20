/** Drift marquee: an endlessly looping track whose speed follows the page
 *  scroll (direction + boost), that can be grabbed and flung, and that accepts
 *  horizontal wheel / shift+wheel. The track must contain two identical halves. */
import { sound } from './sound';
import { prefersReducedMotion } from './env';

/** Horizontal wheel handler (trackpad swipes, shift+wheel). Returns cleanup. */
export function onHorizontalWheel(el: HTMLElement, fn: (dx: number, e: WheelEvent) => boolean | void) {
  const h = (e: WheelEvent) => {
    if (e.defaultPrevented || e.ctrlKey) return;
    const horiz = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (!horiz && !e.shiftKey) return;
    const raw = horiz ? e.deltaX : e.deltaY;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? Math.min(el.clientWidth, window.innerWidth) : 1;
    const dx = Number.isFinite(raw) ? raw * unit : 0;
    if (dx && fn(dx, e) !== false) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  el.addEventListener('wheel', h, { passive: false });
  return () => el.removeEventListener('wheel', h);
}

export interface DriftHandle {
  dragDistance: () => number;
  /** Stop the automatic drift (drag and wheel still work); `resume` restarts it. */
  pause: () => void;
  resume: () => void;
  /** Glide (.7s, cubic in-out) so `el` sits in the viewport centre. Returns whether
   *  the target landed in the other half of the loop (so its twin is the one shown). */
  centerOn: (el: HTMLElement) => { flipped: boolean };
  isCentering: () => boolean;
  destroy: () => void;
}

export function initDrift(track: HTMLElement, { baseSpeed = 0.35, mirror = false } = {}): DriftHandle {
  const sign = mirror ? -1 : 1;
  const reduced = prefersReducedMotion();
  let raf = 0;
  let x = 0;
  let dir = -1;
  let vel = -sign * baseSpeed;
  let fling = 0;
  let scrollBoost = 0;
  let lastY = window.scrollY;
  let lastX = 0;
  let dragging = false;
  let holdUntil = 0;
  let visible = true;
  let half = track.scrollWidth / 2;
  let dragDist = 0;
  let paused = false;
  let glide = 0;

  const wrap = () => {
    if (half > 0) x = -((((-x) % half) + half) % half);
  };
  const paint = () => {
    track.style.transform = `translate3d(${x}px,0,0)`;
  };
  const measure = () => {
    half = track.scrollWidth / 2;
    wrap();
  };

  const loop = () => {
    if (!visible || reduced || dragging) {
      raf = 0;
      return;
    }
    if (paused || glide || performance.now() <= holdUntil) {
      lastY = window.scrollY;
      raf = requestAnimationFrame(loop);
      return;
    }
    const y = window.scrollY;
    const dy = y - lastY;
    lastY = y;
    if (dy < -0.5) dir = 1;
    else if (dy > 0.5) dir = -1;
    const target = Math.min(0.08 * Math.abs(dy), 2.4);
    scrollBoost += (target - scrollBoost) * 0.08;
    const d = dir * sign;
    vel += (d * baseSpeed - vel) * 0.05;
    fling *= 0.92;
    if (Math.abs(fling) < 0.01) fling = 0;
    x += vel + d * scrollBoost + fling;
    wrap();
    paint();
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (raf) return;
    lastY = window.scrollY;
    raf = requestAnimationFrame(loop);
  };

  const onMove = (e: PointerEvent) => {
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    x += dx;
    fling = dx;
    dragDist += Math.abs(dx);
    if (Math.abs(dx) > 6) sound.tick(Math.min(1, Math.abs(dx) / 28));
    if (dx < -0.4) dir = -sign;
    else if (dx > 0.4) dir = sign;
    wrap();
    paint();
  };
  const onUp = () => {
    dragging = false;
    track.style.cursor = 'grab';
    start();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };
  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    fling = 0;
    dragDist = 0;
    track.style.cursor = 'grabbing';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  track.style.cursor = 'grab';
  track.style.touchAction = 'pan-y';
  track.style.userSelect = 'none';
  track.style.willChange = 'transform';
  track.addEventListener('pointerdown', onDown);
  const offWheel = onHorizontalWheel(track, (dx) => {
    if (dragging || half <= 0) return false;
    x -= dx;
    fling = 0;
    scrollBoost = 0;
    dir = Math.sign(-dx) * sign;
    vel = dir * sign * baseSpeed;
    holdUntil = performance.now() + 160;
    wrap();
    paint();
  });
  const ro = new ResizeObserver(measure);
  ro.observe(track);
  window.addEventListener('resize', measure);
  const io = new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting;
    if (visible) start();
  }, { rootMargin: '25% 0px' });
  io.observe(track);
  paint();
  start();

  // Swallow the click that ends a drag so links inside don't fire.
  let downAt = 0;
  const onClickCapture = (e: MouseEvent) => {
    if (track.contains(e.target as Node) && e.detail > 0 && dragDist > 6 && performance.now() - downAt < 600) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  track.addEventListener('pointerup', () => (downAt = performance.now()));
  window.addEventListener('click', onClickCapture, true);

  const stopGlide = () => {
    cancelAnimationFrame(glide);
    glide = 0;
  };
  track.addEventListener('pointerdown', stopGlide);
  const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  return {
    dragDistance: () => dragDist,
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
      fling = 0;
      wrap();
      paint();
      start();
    },
    centerOn: (el: HTMLElement) => {
      measure();
      const r = el.getBoundingClientRect();
      let to = x + (window.innerWidth / 2 - (r.left + r.width / 2));
      let laps = 0;
      while (half > 0 && to <= -half) { to += half; laps++; }
      while (half > 0 && to > 0) { to -= half; laps++; }
      stopGlide();
      const from = x, t0 = performance.now(), dur = reduced ? 0 : 700;
      const step = (now: number) => {
        const p = dur ? Math.min(1, (now - t0) / dur) : 1;
        x = from + (to - from) * easeInOut(p);
        paint();
        glide = p < 1 ? requestAnimationFrame(step) : 0;
      };
      glide = requestAnimationFrame(step);
      return { flipped: laps % 2 === 1 };
    },
    isCentering: () => glide !== 0,
    destroy: () => {
      stopGlide();
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      offWheel();
      window.removeEventListener('resize', measure);
      window.removeEventListener('click', onClickCapture, true);
      track.removeEventListener('pointerdown', onDown);
    },
  };
}
