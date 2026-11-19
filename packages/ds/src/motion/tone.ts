/** Section tones: every top-level [data-tone] section switches body[data-theme]
 *  when it crosses the top of the viewport; the background, nav and text colours
 *  then cross-fade through CSS transitions (1s, editorial ease). */
import { ScrollTrigger } from './gsap';
import { deferInit } from './schedule';

const MAP: Record<string, string> = { light: 'tone-light', dark: 'tone-dark', purple: 'tone-purple', 'dark-video': 'tone-dark' };
export const TONE_RESCAN = 'v:tone-rescan';

export function initTones(fallback?: string) {
  const apply = (el: Element | null) => {
    // data-tone-hold: a pinned scene is driving the theme itself.
    if (document.body.hasAttribute('data-footer-dark') || document.body.hasAttribute('data-tone-hold')) return;
    const t = el ? MAP[el.getAttribute('data-tone') ?? ''] : fallback;
    if (t) document.body.setAttribute('data-theme', t);
  };
  const sections = () =>
    Array.from(document.querySelectorAll('[data-tone]')).filter((el) => !el.parentElement?.closest('[data-tone]'));
  const atTop = (els: Element[]) => els.find((el) => {
    const r = el.getBoundingClientRect();
    return r.top <= 0 && r.bottom > 0;
  }) ?? null;

  let triggers: ScrollTrigger[] = [];
  const bind = () => {
    triggers.forEach((t) => t.kill());
    const els = sections();
    triggers = els.map((el, i) =>
      ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: 'bottom top',
        onToggle: (s) => s.isActive && apply(el),
        onLeaveBack: i === 0 ? () => apply(null) : undefined,
      }),
    );
    // Nothing at the top yet (e.g. a self-managed pinned intro above the first
    // toned section): keep the page's own theme instead of borrowing the next one.
    const first = els[0];
    apply(atTop(els) ?? (first && first.getBoundingClientRect().top > 0 ? null : first ?? null));
  };
  // Bound after first paint: creating triggers measures layout.
  deferInit(bind);
  window.addEventListener(TONE_RESCAN, () => deferInit(bind));
}
