/** Behaviour for PartnerList.astro (timings from the reference):
 *  - hover (fine pointers): chip 300 ms, category decode, strip after 130 ms, strip items
 *    slide in from 28 px right-to-left (480 ms, 55 ms apart, --ease-reveal);
 *  - open: accordion 520 ms, copy fades down 500 ms; desktop keeps one row open, phones
 *    any number; visible strip thumbnails (max 8) fly into their gallery cells, the
 *    other cells drop in (560 ms, 40 ms apart); touch tablets scroll the row up;
 *  - close: cells fade out (380 ms, 45 ms apart) while the accordion folds;
 *  - gallery: drag-to-scroll with inertia on desktop, snap rail with dots on phones;
 *    clips play muted while on screen. */
import { createDecode } from '@valtier/ds/motion/scramble';
import { initDragScroll } from '@valtier/ds/motion/drag-scroll';
import { fly, fadeAway } from '@valtier/ds/motion/flight';
import { isPhone, onLayoutChange, pageX, prefersReducedMotion } from '@valtier/ds/motion/env';
import { afterVeil, arrivedByTransition } from '@valtier/ds/motion/veil';
import { scrollToY } from '@valtier/ds/motion/scroll';
import { sound } from '@valtier/ds/motion/sound';

interface Row {
  li: HTMLElement;
  head: HTMLButtonElement;
  cat: HTMLElement;
  catWrap: HTMLElement;
  panel: HTMLElement;
  decode: ReturnType<typeof createDecode>;
  strip: HTMLElement | null;
  stripTimer: number;
  gallery: HTMLElement | null;
  track: HTMLElement | null;
  cleanup: (() => void) | null;
  pauseTimer: number;
}

const hoverMq = matchMedia('(hover: hover)');

export function initPartnerList(root: HTMLElement) {
  if ((root as any)._pt) return;
  (root as any)._pt = true;

  if (arrivedByTransition()) afterVeil(() => root.setAttribute('data-intro', ''));

  let canHover = hoverMq.matches;
  let phone = isPhone();
  let hovered: Row | null = null;
  const open = new Set<Row>();

  const rows: Row[] = Array.from(root.querySelectorAll<HTMLElement>('[data-pt-row]')).map((li) => {
    const cat = li.querySelector<HTMLElement>('[data-pt-cat]')!;
    return {
      li,
      head: li.querySelector<HTMLButtonElement>('[data-pt-head]')!,
      cat,
      catWrap: cat.parentElement!,
      panel: li.querySelector<HTMLElement>('[data-pt-panel]')!,
      decode: createDecode(cat, cat.textContent || ''),
      strip: null,
      stripTimer: 0,
      gallery: null,
      track: null,
      cleanup: null,
      pauseTimer: 0,
    };
  });

  /* ---- hover chip + strip ------------------------------------------------ */
  const hideStrip = (r: Row) => {
    clearTimeout(r.stripTimer);
    r.stripTimer = 0;
    r.strip?.remove();
    r.li.classList.remove('is-strip');
  };

  const showStrip = (r: Row) => {
    if (!r.strip) {
      const t = r.li.querySelector<HTMLTemplateElement>('template[data-pt-strip]');
      if (!t) return;
      r.strip = (t.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
    }
    const s = r.strip;
    s.style.visibility = 'hidden';
    s.style.left = '52%';
    r.head.append(s);
    if (getComputedStyle(s).display === 'none') return hideStrip(r); // phones / narrow: no strip
    const n = r.head.clientWidth;
    const left = Math.round(Math.max(0.5 * n, n - pageX() - s.scrollWidth));
    s.style.left = `${left}px`;
    const kids = Array.from(s.children) as HTMLElement[];
    const vw = window.innerWidth;
    const inView = kids.map((k) => left + k.offsetLeft < vw);
    const last = inView.lastIndexOf(true);
    kids.forEach((k, i) => {
      k.style.animation = 'none';
      void k.offsetWidth;
      k.style.animation = inView[i] && !prefersReducedMotion() ? `pt-strip-in 480ms cubic-bezier(0.16, 1, 0.3, 1) ${(last - i) * 55}ms both` : 'none';
    });
    s.style.visibility = '';
    r.li.classList.add('is-strip');
  };

  const sync = (r: Row) => {
    const isOpen = open.has(r);
    const chip = canHover && hovered === r && !isOpen;
    r.li.classList.toggle('is-chip', chip);
    r.li.classList.toggle('is-open', isOpen);
    if (canHover && !(chip || isOpen)) r.catWrap.setAttribute('aria-hidden', 'true');
    else r.catWrap.removeAttribute('aria-hidden');
    if (canHover && hovered === r) r.decode.play();
    else r.decode.rearm();
    if (chip) {
      if (!r.stripTimer && !r.strip?.isConnected) r.stripTimer = window.setTimeout(() => { r.stripTimer = 0; showStrip(r); }, 130);
    } else hideStrip(r);
  };

  const setHovered = (r: Row | null) => {
    const prev = hovered;
    hovered = r;
    if (prev && prev !== r) sync(prev);
    if (r) sync(r);
  };

  /* ---- gallery --------------------------------------------------------- */
  const videosIn = (r: Row) => Array.from(r.gallery?.querySelectorAll('video') ?? []);

  const watchVideos = (r: Row) => {
    if (prefersReducedMotion()) return () => {};
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting && open.has(r)) {
          if (!v.getAttribute('src') && v.dataset.src) v.src = v.dataset.src;
          v.play().catch(() => {});
        } else if (!v.paused) v.pause();
      }
    }, { rootMargin: '10% 0px' });
    videosIn(r).forEach((v) => {
      v.addEventListener('playing', () => v.setAttribute('data-playing', ''), { once: true });
      io.observe(v);
    });
    return () => io.disconnect();
  };

  const initRail = (r: Row) => {
    const track = r.track!;
    const cells = Array.from(track.children) as HTMLElement[];
    const dots = Array.from(r.gallery!.querySelectorAll<HTMLButtonElement>('[data-pt-go]'));
    let active = -1;
    const step = () => (cells[1] ? cells[1].offsetLeft - cells[0].offsetLeft : cells[0]?.offsetWidth || 1);
    const update = () => {
      const i = Math.max(0, Math.min(cells.length - 1, Math.round(track.scrollLeft / step())));
      if (i === active) return;
      active = i;
      cells.forEach((c, k) => c.toggleAttribute('aria-current', k === i));
      dots.forEach((d, k) => (k === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
    };
    const onScroll = () => update();
    track.addEventListener('scroll', onScroll, { passive: true });
    dots.forEach((d) => d.addEventListener('click', () => track.scrollTo({ left: step() * +d.dataset.ptGo!, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })));
    update();
    return () => track.removeEventListener('scroll', onScroll);
  };

  const mountGallery = (r: Row) => {
    if (r.gallery) return;
    const t = r.li.querySelector<HTMLTemplateElement>('template[data-pt-gal]');
    const slot = r.li.querySelector<HTMLElement>('[data-pt-gal-slot]');
    if (!t || !slot) return;
    slot.append(t.content.cloneNode(true));
    r.gallery = slot.querySelector('.pt-gal');
    r.track = slot.querySelector('[data-pt-track]');
    if (!r.track) return;
    const offVideos = watchVideos(r);
    const offMode = phone ? initRail(r) : initDragScroll(r.track).destroy;
    r.cleanup = () => { offVideos(); offMode(); };
  };

  const cellsOf = (r: Row) => Array.from(r.track?.children ?? []) as HTMLElement[];

  const toggle = (r: Row) => {
    const opening = !open.has(r);
    if (opening) {
      const fine = canHover && !prefersReducedMotion();
      const flights = fine && r.strip?.isConnected
        ? (Array.from(r.strip.children) as HTMLElement[])
            .map((node, k) => ({ node, k, rect: node.getBoundingClientRect() }))
            .filter((f) => f.rect.width > 0 && f.rect.left < window.innerWidth && f.rect.right > 0)
            .slice(0, 8)
        : [];
      if (!phone) for (const o of [...open]) if (o !== r) close(o);
      open.add(r);
      clearTimeout(r.pauseTimer);
      mountGallery(r);
      r.head.setAttribute('aria-expanded', 'true');
      r.panel.removeAttribute('inert');
      r.panel.setAttribute('aria-hidden', 'false');
      const flying = new Set(flights.map((f) => f.k));
      cellsOf(r).forEach((c, k) => {
        c.style.animation = 'none';
        void c.offsetWidth;
        c.style.animation = flying.has(k) || prefersReducedMotion() ? 'none' : `pt-cell-drop 560ms cubic-bezier(0.16, 1, 0.3, 1) ${40 * Math.min(k, 12)}ms both`;
      });
      sync(r);
      sound.card();
      if (flights.length) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const vw = window.innerWidth;
          const pairs: { from: DOMRect; node: Element; target: HTMLElement }[] = [];
          const rest: { from: DOMRect; node: Element }[] = [];
          for (const f of flights) {
            const target = r.track?.querySelector<HTMLElement>(`[data-gal-cell="${f.k}"]`);
            if (target && target.getBoundingClientRect().left < vw) pairs.push({ from: f.rect, node: f.node, target });
            else rest.push({ from: f.rect, node: f.node });
          }
          fly(pairs, { radius: [3, 0], hideTargets: true });
          fadeAway(rest, 3);
        }));
      }
      if (!canHover && !phone) {
        window.setTimeout(() => {
          const top = r.li.getBoundingClientRect().top;
          if (top <= 0.35 * window.innerHeight) return;
          scrollToY(window.scrollY + top - 96, { duration: 0.6, immediate: prefersReducedMotion() });
        }, 420);
      }
    } else close(r);
  };

  function close(r: Row) {
    if (!open.delete(r)) return;
    r.head.setAttribute('aria-expanded', 'false');
    r.panel.setAttribute('inert', '');
    r.panel.setAttribute('aria-hidden', 'true');
    cellsOf(r).forEach((c, k) => {
      c.style.animation = prefersReducedMotion() ? 'none' : `pt-cell-out 380ms ease ${45 * Math.min(k, 10)}ms both`;
    });
    clearTimeout(r.pauseTimer);
    r.pauseTimer = window.setTimeout(() => videosIn(r).forEach((v) => v.pause()), 560);
    sync(r);
  }

  /* ---- wiring ----------------------------------------------------------- */
  for (const r of rows) {
    r.head.addEventListener('mouseenter', () => setHovered(r));
    r.head.addEventListener('mouseleave', () => hovered === r && setHovered(null));
    r.head.addEventListener('focus', () => setHovered(r));
    r.head.addEventListener('blur', () => hovered === r && setHovered(null));
    r.head.addEventListener('click', () => toggle(r));
    sync(r);
  }

  hoverMq.addEventListener('change', () => {
    canHover = hoverMq.matches;
    rows.forEach(sync);
  });
  onLayoutChange((p) => {
    if (p === phone) return;
    phone = p;
    // Galleries switch layout in CSS; rebuild their behaviour for the new mode.
    for (const r of rows) {
      if (!r.gallery || !r.track) continue;
      r.cleanup?.();
      const offVideos = watchVideos(r);
      const offMode = phone ? initRail(r) : initDragScroll(r.track).destroy;
      if (!phone) cellsOf(r).forEach((c) => c.removeAttribute('aria-current'));
      r.cleanup = () => { offVideos(); offMode(); };
    }
    if (!phone && open.size > 1) [...open].slice(0, -1).forEach(close);
  });
  // Close the hover strip when the page scrolls under a still pointer.
  window.addEventListener('scroll', () => { if (hovered && !hovered.head.matches(':hover, :focus-visible')) setHovered(null); }, { passive: true });
}
