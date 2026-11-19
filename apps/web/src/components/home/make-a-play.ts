/** "Make a play" belt (see MakeAPlay.astro). */
import { gsap, ScrollTrigger } from '@valtier/ds/motion/gsap';
import { isPhone, prefersReducedMotion } from '@valtier/ds/motion/env';
import { initDrift } from '@valtier/ds/motion/drift';
import { initAllDotReveals } from '@valtier/ds/motion/dot-reveal';
import { sound } from '@valtier/ds/motion/sound';

export function initMakeAPlay() {
  const sec = document.querySelector<HTMLElement>('[data-section="make-a-play"]');
  if (!sec) return;
  const belt = sec.querySelector<HTMLElement>('[data-mp-belt]')!;
  const cards = Array.from(sec.querySelectorAll<HTMLElement>('[data-mp-card]'));
  const frames = Array.from(sec.querySelectorAll<HTMLElement>('[data-mp-frame]'));
  const reduced = prefersReducedMotion();
  const phone = isPhone();
  const hoverNone = window.matchMedia('(hover: none)').matches;
  initAllDotReveals(sec);

  // Random tilt per print; hovering straightens it, leaving re-rolls it.
  const amp = phone ? 3 : 4.5;
  const roll = (f: HTMLElement, a = amp) => f.style.setProperty('--rot', `${((Math.random() * 2 - 1) * a).toFixed(2)}deg`);
  frames.forEach((f) => {
    roll(f);
    if (hoverNone) return;
    f.addEventListener('mouseenter', () => { f.setAttribute('data-hover', ''); sound.hover?.(); });
    f.addEventListener('mouseleave', () => { f.removeAttribute('data-hover'); roll(f, 4.5); });
  });

  // Arrival: prints rise from below at staggered speeds.
  if (!reduced) {
    cards.forEach((c, i) => gsap.set(c, { y: 160 + ((53 * i) % 5) * 52 }));
    ScrollTrigger.create({
      trigger: sec, start: 'top 78%', once: true,
      onEnter: () => {
        sound.whoosh?.(0.85);
        belt.style.pointerEvents = 'none';
        let end = 0;
        cards.forEach((c, i) => {
          const d = 0.95 + ((29 * i) % 4) * 0.22, delay = (i % 3) * 0.05;
          end = Math.max(end, d + delay);
          gsap.to(c, { y: 0, duration: d, delay, ease: 'power3.out', overwrite: true });
        });
        gsap.delayedCall(end, () => (belt.style.pointerEvents = ''));
      },
    });
  }

  initDrift(belt, { baseSpeed: 0.32 });

  // The tail of the page (this section + footer) keeps the nav ink-coloured.
  ScrollTrigger.create({
    trigger: sec, start: 'top bottom', end: () => `+=${document.body.scrollHeight}`,
    onToggle: (s) => document.documentElement.toggleAttribute('data-home-tail', s.isActive),
  });
}
