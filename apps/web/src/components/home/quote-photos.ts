/** Quote photos (see QuotePhotos.astro). Positions on the scrubbed timeline are
 *  expressed in "vh of the section" like the reference: photo i lands over
 *  [110 + 44i (+52 on phones) − 36, +36] of 236 (phones: 300). */
import { gsap, ScrollTrigger } from '@valtier/ds/motion/gsap';
import { isPhone, prefersReducedMotion } from '@valtier/ds/motion/env';
import { setScrollScale } from '@valtier/ds/motion/scroll';
import { emitReveal } from '@valtier/ds/motion/dot-reveal';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);

export function initQuotePhotos() {
  const section = $('[data-section="quote-photos"]');
  if (!section) return;
  const phone = isPhone();
  const reduced = prefersReducedMotion();
  const field = $('[data-qp-field]', section)!;
  const grass = $('[data-qp-grass]', section);
  const pebble = $('[data-qp-pebble]', section);
  const sticky = $('[data-qp-sticky]', section)!;
  const photos = Array.from(section.querySelectorAll<HTMLElement>('[data-qp-photo]'));
  const H = phone ? 300 : 236;
  const pane = () => sticky.offsetHeight || window.innerHeight;

  // Fixed field: visible while the section overlaps the viewport, fading as it leaves.
  if (!phone) {
    const vis = () => {
      const r = section.getBoundingClientRect(), h = window.innerHeight || 1;
      gsap.set(field, { autoAlpha: r.top < h ? Math.max(0, Math.min(1, r.bottom / h)) : 0 });
    };
    ScrollTrigger.create({ trigger: section, start: 'top bottom', end: 'bottom top', onUpdate: vis, onToggle: vis, onRefresh: vis });
    vis();
  }

  photos.forEach((p) => gsap.set(p, { opacity: 1 }));
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: section,
      start: phone ? () => `top top+=${pane()}` : 'top bottom',
      end: phone ? () => `bottom top+=${pane()}` : 'bottom bottom',
      scrub: 0.9,
      invalidateOnRefresh: true,
      onToggle: (s) => setScrollScale(s.isActive ? 0.8 : 1),
    },
  });
  if (phone) tl.add(() => {}, 1);
  photos.forEach((el, i) => {
    const rot = parseFloat(el.dataset.rot || '0'), x = parseFloat(el.dataset.x || '0');
    if (reduced) { gsap.set(el, { rotation: rot, xPercent: x }); return; }
    tl.fromTo(
      el,
      { x: 0, y: 0, xPercent: x, yPercent: () => ((pane() / 2 + (el.offsetHeight || 1) / 2) / (el.offsetHeight || 1)) * 100 + 35, rotation: -2 * rot, opacity: 1 },
      { y: 0, yPercent: 0, rotation: rot, duration: 36 / H, ease: 'power2.out' },
      (110 + 44 * i + (phone ? 52 : 0) - 36) / H,
    );
  });
  if (!phone) {
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--color-ink-deep').trim() || '#171220';
    const from = getComputedStyle(field).backgroundColor;
    tl.fromTo(field, { backgroundColor: from }, { backgroundColor: ink, duration: 130 / H }, 82 / H);
    if (grass) tl.fromTo(grass, { opacity: 1 }, { opacity: 0, duration: 130 / H }, 82 / H);
    if (pebble) tl.fromTo(pebble, { opacity: 0 }, { opacity: 1, duration: 130 / H }, 82 / H);
  }

  // Phones: the quote rises into place, then its lines dot-reveal.
  const inner = $('[data-qp-phone-inner]', section);
  const desc = $('[data-qp-desc]', section);
  if (phone && inner) {
    import('@valtier/ds/motion/dot-reveal').then(({ initDotReveal }) => {
      section.querySelectorAll<HTMLElement>('[data-dot-reveal]').forEach(initDotReveal);
    });
    let shown: boolean | null = null, tw: gsap.core.Tween | null = null;
    const reveal = (on: boolean) => {
      if (shown === on) return;
      shown = on;
      emitReveal('v:home-quote', on);
      tw?.kill();
      if (!desc) return;
      if (on) tw = gsap.to(desc, { opacity: 0.85, duration: 0.9, delay: 0.9, ease: 'power1.inOut' });
      else desc.style.opacity = '0';
    };
    const set = (t: number) => {
      const r = reduced ? 1 : 1 - (1 - t) * (1 - t);
      inner.style.transform = `translate3d(0, ${(55 * (1 - r)).toFixed(3)}%, 0) scale(${(1.25 - 0.25 * r).toFixed(4)})`;
      reveal(t >= 0.86);
    };
    set(0);
    ScrollTrigger.create({
      trigger: section, start: () => `top top+=${pane()}`, end: 'top top', scrub: true, invalidateOnRefresh: true,
      onUpdate: (s) => set(s.progress), onLeaveBack: () => set(0),
    });
  }
}
