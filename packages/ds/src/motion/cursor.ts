/** Contextual cursor label: hovering anything with [data-cursor="Label"] shows a
 *  bone pill that trails the pointer (fine pointers, motion allowed only). */
import { gsap } from './gsap';
import { EASE } from './env';

export function initCursor(pill: HTMLElement) {
  const label = pill.querySelector('span');
  if (!label) return;
  const mm = gsap.matchMedia();
  mm.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
    let active: HTMLElement | null = null;
    let pos: { x: number; y: number } | null = null;
    const qx = gsap.quickTo(pill, 'x', { duration: 0.24, ease: 'power3.out' });
    const qy = gsap.quickTo(pill, 'y', { duration: 0.24, ease: 'power3.out' });
    const hide = () => {
      if (!active) return;
      active = null;
      gsap.to(pill, { autoAlpha: 0, scale: 0.88, duration: 0.18, overwrite: 'auto' });
    };
    const update = () => {
      if (!pos || document.body.classList.contains('menu-open')) return hide();
      const hit = document.elementFromPoint(pos.x, pos.y);
      const target = hit?.closest<HTMLElement>('[data-cursor]');
      const blocked = hit?.closest("[inert], [data-cursor='none']");
      if (!target || blocked) return hide();
      const x = Math.min(pos.x + 22, window.innerWidth - 88);
      const y = Math.min(pos.y + 20, window.innerHeight - 48);
      if (active) {
        qx(x);
        qy(y);
      } else {
        qx(x, x);
        qy(y, y);
      }
      if (target !== active || label.textContent !== target.dataset.cursor) {
        active = target;
        label.textContent = target.dataset.cursor ?? '';
        gsap.to(pill, { autoAlpha: 1, scale: 1, duration: 0.3, ease: EASE.reveal, overwrite: 'auto' });
      }
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pos = { x: e.clientX, y: e.clientY };
      update();
    };
    const leave = () => {
      pos = null;
      hide();
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('scroll', hide, { passive: true });
    window.addEventListener('blur', leave);
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('scroll', hide);
      window.removeEventListener('blur', leave);
      document.documentElement.removeEventListener('pointerleave', leave);
      gsap.set(pill, { autoAlpha: 0 });
    };
  });
}
