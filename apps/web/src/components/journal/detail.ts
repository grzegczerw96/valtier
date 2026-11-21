/** Desktop detail: a bone "file tab" card in the left column (scaled to fit), the
 *  entry itself flies to the right as the hero (driven by the field), prev / next
 *  arrows sit under the hero and ✕ closes. The card rests on the bottom gutter;
 *  when its content is taller than the screen it pins to the top and the wheel /
 *  arrow keys / a touch drag scroll it while the card shortens to the screen. */
import { gsap } from 'gsap';
import { EASE } from '@valtier/ds/motion/env';
import { notchPath, notchTabEnd, NOTCH } from '@valtier/ds/motion/notch';
import { trapFocus } from '@valtier/ds/motion/focus-trap';
import { cardLayout, expanded, heroBox, type Item } from './layout';
import { fillCommon } from './fill';
import { mountVideo } from './media';

const PAD_TOP = 84, PAD_BOTTOM = 33;
const DEFAULT_BODY = 'Long-form journal copy lands here. The story behind the item — date, place, who was there.';

export interface DetailApi { open(it: Item, withSound: boolean): void; close(): void; readonly isOpen: boolean }

export function createDetail(root: HTMLElement, h: { onClose(): void; onPrev(): void; onNext(): void }): DetailApi {
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const card = $('[data-jr-card]'), shapeSvg = $<SVGSVGElement>('.jr-card__shape'), shape = $<SVGPathElement>('[data-jr-shape]');
  const logos = $('[data-jr-logos]'), clip = $('[data-jr-clip]'), scroller = $('[data-jr-scroll]');
  const top = $('[data-jr-top]'), bottom = $('[data-jr-bottom]'), gap = $('[data-jr-gap]');
  const media = $('[data-jr-media]'), heading = $('[data-jr-h]'), body = $('[data-jr-p]');
  const arrows = $('[data-jr-arrows]'), closeBtn = $('[data-jr-close]'), home = $('[data-jr-home]');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  let item: Item | null = null;
  let isOpen = false, closing = false;
  let heights: { top: number; bottom: number } | null = null;
  let scrollQ = 0, maxScroll = 0, scale = 1;
  let flat: number = NOTCH.flatEnd, flatTarget: number = NOTCH.flatEnd;
  let homeEdge = 104;
  let openedAt = 0;
  let unmountVideo: (() => void) | null = null;
  let release: (() => void) | null = null;
  let introTl: gsap.core.Timeline | null = null;
  let contentTw: gsap.core.Tween | null = null;
  let glide = 0;

  function layout() {
    if (!item) return;
    const W = window.innerWidth, H = window.innerHeight, wide = expanded(item);
    const L = cardLayout(W, wide, H);
    scale = L.scale;
    card.dataset.journalLayout = wide ? 'expanded' : 'compact';
    card.style.left = `${L.left}px`;
    card.style.width = `${L.width}px`;
    gsap.set(card, { scale: L.scale, transformOrigin: 'top left' });
    if (!heights) return;
    const natural = heights.top + heights.bottom + 40 + PAD_TOP + PAD_BOTTOM;
    const maxH = (H - L.topOffset - L.bottomMargin) / L.scale;
    const minH = wide && !L.mobile ? (H - L.restTopOffset - L.bottomMargin) / L.scale : 0;
    const over = natural > maxH;
    maxScroll = over ? natural - maxH : 0;
    const q = Math.min(scrollQ, maxScroll);
    // Deliberate change from the reference: the card always spans the full column
    // (top gutter to bottom gutter), so it never moves or resizes between entries.
    void minH;
    const ch = over ? Math.max(maxH, natural - q) : maxH;
    const y = L.topOffset;
    const inner = ch - PAD_TOP - PAD_BOTTOM;
    card.style.top = `${y}px`;
    card.style.height = `${ch}px`;
    shapeSvg.setAttribute('viewBox', `0 0 ${L.width} ${ch}`);
    shape.setAttribute('d', notchPath(L.width, ch, flat));
    clip.style.height = `${inner}px`;
    scroller.style.transform = `translateY(${-q}px)`;
    gap.style.height = `${over ? 40 : Math.max(40, inner - heights.top - heights.bottom)}px`;
    const hb = heroBox(W, H, wide);
    arrows.style.left = `${hb.cx}px`;
    arrows.style.top = `${hb.cy + hb.boxH / 2 + 16}px`;
    const showHome = y >= homeEdge;
    home.toggleAttribute('data-show', showHome);
    home.setAttribute('aria-hidden', String(!showHome));
    home.tabIndex = showHome ? 0 : -1;
  }

  const measure = () => {
    heights = { top: top.offsetHeight, bottom: bottom.offsetHeight };
    layout();
  };
  new ResizeObserver(() => isOpen && measure()).observe(top);
  new ResizeObserver(() => isOpen && measure()).observe(bottom);
  window.addEventListener('resize', () => {
    if (!isOpen) return;
    homeEdge = home.querySelector('svg')!.getBoundingClientRect().bottom + 28 || homeEdge;
    layout();
  });

  // tab width follows the lock-up (brand names differ in length)
  let tabT = 0;
  new ResizeObserver(() => {
    clearTimeout(tabT);
    tabT = window.setTimeout(() => {
      const to = notchTabEnd(logos.offsetWidth);
      if (to === flatTarget) return;
      flatTarget = to;
      if (reduced() || !isOpen) { flat = to; layout(); return; }
      const o = { v: flat };
      gsap.to(o, { v: to, duration: 0.55, ease: 'power3.out', onUpdate: () => { flat = o.v; layout(); } });
    }, 90);
  }).observe(logos);

  // ---- scrolling the card
  const scrollBy = (d: number) => {
    if (maxScroll <= 0) return;
    scrollQ = Math.max(0, Math.min(Math.min(scrollQ, maxScroll) + d / scale, maxScroll));
    layout();
  };
  // Wheel: over a card taller than the screen it scrolls the card; anywhere else one
  // gesture steps to the next / previous entry (a trackpad swipe or a run of wheel
  // clicks counts once: the next step waits until the wheel has been quiet 180 ms).
  let acc = 0, quiet = 0, locked = false;
  root.addEventListener('wheel', (e) => {
    if (!isOpen) return;
    e.preventDefault();
    if (closing) return;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
    const dy = e.deltaY * unit, dx = e.deltaX * unit;
    if (maxScroll > 0 && card.contains(e.target as Node) && Math.abs(dy) >= Math.abs(dx)) {
      scrollBy(dy);
      return;
    }
    clearTimeout(quiet);
    quiet = window.setTimeout(() => { locked = false; acc = 0; }, 180);
    if (locked) return;
    acc += Math.abs(dx) > Math.abs(dy) ? dx : dy;
    if (Math.abs(acc) < 40) return;
    locked = true;
    const d = acc;
    acc = 0;
    if (d > 0) h.onNext();
    else h.onPrev();
  }, { passive: false });
  let touch: { id: number; sy: number; ly: number; lt: number; v: number; captured: boolean } | null = null;
  card.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    cancelAnimationFrame(glide);
    touch = { id: e.pointerId, sy: e.clientY, ly: e.clientY, lt: e.timeStamp, v: 0, captured: false };
  });
  card.addEventListener('pointermove', (e) => {
    const t = touch;
    if (!t || t.id !== e.pointerId) return;
    if (!t.captured && Math.abs(e.clientY - t.sy) > 8) { t.captured = true; try { card.setPointerCapture(e.pointerId); } catch {} }
    const d = t.ly - e.clientY, dt = e.timeStamp - t.lt;
    if (dt > 0) t.v = (d / dt) * 0.8 + 0.2 * t.v;
    t.ly = e.clientY; t.lt = e.timeStamp;
    scrollBy(d);
  });
  const touchEnd = (e: PointerEvent) => {
    const t = touch;
    if (!t || t.id !== e.pointerId) return;
    touch = null;
    let v = t.v;
    if (Math.abs(v) < 0.25) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last; last = now;
      scrollBy(v * dt);
      v *= Math.pow(0.92, dt / 16.7);
      if (Math.abs(v) > 0.02) glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  };
  card.addEventListener('pointerup', touchEnd);
  card.addEventListener('pointercancel', touchEnd);

  window.addEventListener('keydown', (e) => {
    if (!isOpen || closing || e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.target as Element)?.closest?.('input, textarea, select, video, audio, [contenteditable="true"]')) return;
    const k = e.key;
    if (k === 'ArrowLeft') h.onPrev();
    else if (k === 'ArrowRight') h.onNext();
    else if (k === 'ArrowDown') scrollBy(72);
    else if (k === 'ArrowUp') scrollBy(-72);
    else if (k === 'PageDown') scrollBy(0.8 * innerHeight);
    else if (k === 'PageUp') scrollBy(-0.8 * innerHeight);
    else if (k === 'End') { scrollQ = maxScroll; layout(); }
    else if (k === 'Home') { scrollQ = 0; layout(); }
    else return;
    e.preventDefault();
  });

  $('[data-jr-backdrop]').addEventListener('click', () => { if (performance.now() - openedAt >= 500) close(); });
  closeBtn.addEventListener('click', () => close());
  $('[data-jr-prev]').addEventListener('click', () => !closing && h.onPrev());
  $('[data-jr-next]').addEventListener('click', () => !closing && h.onNext());

  // ---- content
  function fill(it: Item, withSound: boolean) {
    unmountVideo?.();
    unmountVideo = null;
    const wide = expanded(it);
    root.setAttribute('aria-label', it.label);
    heading.textContent = it.label;
    const showBody = !!it.body || !wide;
    body.hidden = !showBody;
    body.textContent = it.body ?? DEFAULT_BODY;
    // Every card leads with a 16:9 frame: the clip, or the entry's still photo.
    media.hidden = false;
    if (it.kind === 'video' && it.video) unmountVideo = mountVideo(media, it.video, it.label, true, withSound);
    else {
      const img = new Image();
      img.className = 'jr-media__still';
      img.src = it.still ?? it.src;
      img.alt = it.alt;
      img.draggable = false;
      media.append(img);
      unmountVideo = () => media.replaceChildren();
    }
    fillCommon(root, it, { brand: '[data-jr-brand]', rows: '[data-jr-rows]', ctaWrap: '[data-jr-cta-wrap]', cta: '[data-jr-cta]', post: '[data-jr-post]' }, true);
    scrollQ = 0;
  }

  function animateContent() {
    contentTw?.kill();
    if (reduced()) return;
    const els = root.querySelectorAll<HTMLElement>('[data-anim]:not([hidden])');
    gsap.set(els, { opacity: 0, y: 16, filter: 'blur(8px)' });
    contentTw = gsap.to(els, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'power3.out', stagger: 0.055, delay: 0.08, clearProps: 'filter,transform' });
  }

  function open(it: Item, withSound: boolean) {
    const first = !isOpen;
    item = it;
    if (first) {
      isOpen = true;
      closing = false;
      openedAt = performance.now();
      root.hidden = false;
      document.body.classList.add('journal-detail-open');
      homeEdge = (home.querySelector('svg')?.getBoundingClientRect().bottom ?? 76) + 28;
    }
    fill(it, withSound);
    heights = null;
    measure();
    if (first) {
      introTl?.kill();
      const L = cardLayout(innerWidth, expanded(it), innerHeight);
      if (reduced()) {
        gsap.set(card, { autoAlpha: 1, x: 0, y: 0 });
        gsap.set([closeBtn, arrows], { autoAlpha: 1 });
      } else {
        gsap.set(card, { autoAlpha: 0, x: L.mobile ? 0 : -56, y: L.mobile ? 110 : 0 });
        gsap.set([closeBtn, arrows], { autoAlpha: 0 });
        introTl = gsap.timeline({ defaults: { ease: EASE.reveal } })
          .to(card, { x: 0, y: 0, autoAlpha: 1, duration: 0.85 }, 0)
          .to([closeBtn, arrows], { autoAlpha: 1, duration: 0.4 }, 0.45);
      }
      release = trapFocus(root, { initial: closeBtn, onEscape: () => close() });
    }
    animateContent();
  }

  function close() {
    if (!isOpen || closing) return;
    closing = true;
    introTl?.kill();
    contentTw?.kill();
    cancelAnimationFrame(glide);
    const done = () => {
      h.onClose();
      isOpen = false;
      closing = false;
      root.hidden = true;
      unmountVideo?.();
      unmountVideo = null;
      document.body.classList.remove('journal-detail-open');
      release?.();
      release = null;
    };
    if (reduced()) return done();
    const mobile = cardLayout(innerWidth, false, innerHeight).mobile;
    gsap.timeline({ defaults: { ease: EASE.editorial }, onComplete: done })
      .to([closeBtn, arrows], { autoAlpha: 0, duration: 0.12 }, 0)
      .to(card, { ...(mobile ? { y: 110 } : { x: -56 }), autoAlpha: 0, duration: 0.3 }, 0);
  }

  return { open, close, get isOpen() { return isOpen; } };
}
