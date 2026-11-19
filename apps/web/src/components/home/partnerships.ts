/** Partnerships + Foundation behaviour (see Partnerships.astro / Foundation.astro).
 *
 *  Desktop: the wrapper is (100n + 120)vh tall. Over the first 100n/(100n+120) of
 *  it each partner owns an equal slice (the dot fills through the slice); then
 *  for 100/(100n+120) the stage lifts away on the slanted wipe (--p-wipe 0→1,
 *  scale 1→.9) to the Foundation underneath. When the page sits still for 1.2s
 *  the current partner's dot fills over 5.5s and the next partner comes in. */
import { gsap, ScrollTrigger } from '@valtier/ds/motion/gsap';
import { isPhone, prefersReducedMotion, vu as vuOf } from '@valtier/ds/motion/env';
import { scrollToY } from '@valtier/ds/motion/scroll';
import { slantClip } from '@valtier/ds/motion/slant';
import { sound } from '@valtier/ds/motion/sound';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll<T>(s));
const AUTO_MS = 5500, IDLE_MS = 1200;

export function initPartnerships() {
  initFoundation();
  if (isPhone()) initRail();
  else initStage();
}

/* ---------------------------------------------------------------- headline fit */
function fitHeadline(host: HTMLElement, word: HTMLElement, varName: string, target: () => number) {
  const fit = () => {
    const w = host.clientWidth;
    if (w <= 0) return;
    const t = target();
    const margin = Math.max(20, Math.min(72, 0.04 * t));
    const fs = parseFloat(getComputedStyle(word).fontSize) || 1;
    const ww = word.getBoundingClientRect().width;
    if (ww <= 0) return;
    host.style.setProperty(varName, `${Math.min((fs * (t - 2 * margin)) / ww, 1200)}px`);
  };
  fit();
  new ResizeObserver(fit).observe(host);
  document.fonts?.ready.then(fit);
}

/* ---------------------------------------------------------------- desktop */
function initStage() {
  const wrap = $('[data-pt]');
  const stage = $('[data-pt-stage]');
  if (!wrap || !stage) return;
  const reduced = prefersReducedMotion();
  const root = document.documentElement;
  const heroes = $('[data-pt-heroes]', stage)!;
  const heroEls = $$('[data-pt-hero]', stage);
  const fills = $$('[data-pt-fill]', stage);
  const dots = $$('[data-pt-dot]', stage);
  const dotsNav = $('[data-pt-dots]', stage)!;
  const text = $('[data-pt-text]', stage)!;
  const name = $('[data-pt-name]', stage)!;
  const desc = $('[data-pt-desc]', stage)!;
  const tex = $('[data-pt-tex]', stage)!;
  const pebble = $('[data-pt-pebble]');
  const nav = $('[data-nav]');
  const fndNav = $('[data-home-foundation-nav]');
  const headline = $('[data-pt-headline]', stage)!;
  const grain = $('[data-pt-grain]', stage)!;
  const n = heroEls.length;
  const names = heroEls.map((_, i) => $$('.pt__sizer .heading', stage)[i]?.textContent ?? '');
  const descs = heroEls.map((_, i) => $$('.pt__sizer p:last-child', stage)[i]?.textContent ?? '');
  const S = 100 * n + 120, dEnd = (100 * n) / S, wEnd = (100 * n + 100) / S;
  const htu = () => (window.visualViewport?.height ?? window.innerHeight) / 100;
  const settle = (v: number) => `${(v * htu()).toFixed(2)}px`;

  fitHeadline(headline, $('[data-pt-word]', stage)!, '--pt-fs', () => Math.min(headline.clientWidth, 100 * vuOf()));
  const alignGrain = () => {
    const r = grain.getBoundingClientRect();
    grain.style.backgroundPosition = `${-r.left}px ${-r.top}px`;
  };

  const depth: ({ setActive(on: boolean): void } | null)[] = heroEls.map(() => null);
  let active = 0, dir: 'down' | 'up' = 'down', slideP = 0, inside = false, hover = false;
  let autoRaf = 0, idleT = 0, lastScroll = 0;
  const paintFill = (i: number, p: number) => {
    const v = Math.max(0, Math.min(1, p));
    fills.forEach((f, k) => (f.style.transform = `translate3d(0, ${(((k === i ? v : 0) - 1) * 100).toFixed(2)}%, 0)`));
  };
  const show = (i: number) => {
    if (i === active) return;
    const prev = active;
    active = i;
    dots.forEach((d, k) => (k === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
    heroEls.forEach((h, k) => h.setAttribute('aria-hidden', String(k !== i)));
    const dy = dir === 'down' ? 22 : -22;
    name.textContent = names[i]; desc.textContent = descs[i];
    if (!reduced) {
      gsap.fromTo(text.children, { opacity: 0, y: dy, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.65, ease: 'power3.out', stagger: 0.07, clearProps: 'filter,transform', overwrite: 'auto' });
      gsap.fromTo(heroEls[i], { opacity: 0, y: dy }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', clearProps: 'transform', overwrite: 'auto' });
      gsap.to(heroEls[prev], { opacity: 0, y: -dy, duration: 0.8, ease: 'power3.out', overwrite: 'auto' });
    } else {
      heroEls.forEach((h, k) => (h.style.opacity = k === i ? '1' : '0'));
    }
    depth.forEach((d, k) => d?.setActive(k === i));
    sound.tab?.(0.9);
  };

  // Text + hero start visible inside the stage; the dots/panel fade with the stage.
  gsap.set(heroes, { opacity: 1, yPercent: 100 });
  gsap.set(text.children, { opacity: 1 });
  gsap.set(dotsNav, { opacity: 1 });
  root.style.setProperty('--p-settle', reduced ? '0px' : settle(15));

  const themeOn = (dark: boolean) => {
    if (document.body.hasAttribute('data-footer-dark')) return;
    document.body.setAttribute('data-theme', dark ? 'tone-dark' : 'tone-light');
  };
  const navClip = (t: number) => {
    const W = window.innerWidth, H = window.innerHeight;
    const navH = nav?.offsetHeight ?? 0, fH = fndNav?.offsetHeight ?? 0;
    if (nav) nav.style.clipPath = t <= 0 || t >= 1 ? '' : slantClip(t, W, navH, H, true);
    fndNav?.style.setProperty('--fnd-nav-clip', t <= 0 || t >= 1 ? 'polygon(0 0, 0 0, 0 0)' : slantClip(t, W, fH, H, false));
  };
  const inStage = (on: boolean) => {
    tex.style.opacity = on ? '1' : '0';
    grain.style.opacity = on ? '0' : '1';
    alignGrain();
  };
  inStage(false);

  const stopAuto = () => { cancelAnimationFrame(autoRaf); autoRaf = 0; };
  const startAuto = () => {
    if (reduced || n < 2 || !inside) return;
    stopAuto();
    let last = performance.now();
    const tick = (now: number) => {
      if (!inside) { autoRaf = 0; return; }
      if (hover) { last = now; autoRaf = requestAnimationFrame(tick); return; }
      const dt = now - last; last = now;
      const p = slideP + dt / AUTO_MS;
      if (p >= 1) { dir = 'down'; slideP = 0; show((active + 1) % n); paintFill(active, 0); }
      else { slideP = p; paintFill(active, p); }
      autoRaf = requestAnimationFrame(tick);
    };
    autoRaf = requestAnimationFrame(tick);
  };
  const armAuto = () => { clearTimeout(idleT); idleT = window.setTimeout(startAuto, IDLE_MS); };
  $('[data-pt-info]', stage)?.addEventListener('mouseenter', () => (hover = true));
  $('[data-pt-info]', stage)?.addEventListener('mouseleave', () => (hover = false));

  ScrollTrigger.create({
    trigger: wrap,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (s) => {
      lastScroll = performance.now();
      const p = s.progress;
      if (p <= dEnd) {
        const c = (dEnd === 0 ? 0 : p / dEnd) * n;
        const i = Math.min(n - 1, Math.floor(c));
        const v = Math.min(1, Math.max(0, c - i));
        if (i !== active) { dir = i > active ? 'down' : 'up'; show(i); }
        slideP = v; paintFill(i, v);
        root.style.setProperty('--p-wipe', '0'); root.style.setProperty('--p-scale', '1');
        wrap.style.backgroundColor = 'transparent';
        if (!reduced) {
          const e = Math.min(1, (p * (S - 100)) / 30);
          root.style.setProperty('--p-settle', settle(15 * (1 - e) * (1 - e)));
          gsap.set(heroes, { y: 0, yPercent: 18 * (1 - e) * (1 - e) });
        }
        if (s.isActive) themeOn(true);
        navClip(0);
        stopAuto();
        if (inside) armAuto();
      } else if (p <= wEnd) {
        const r = Math.max(0, Math.min(1, (p - dEnd) / (wEnd - dEnd)));
        if (active !== n - 1) { dir = 'down'; show(n - 1); }
        slideP = 1; paintFill(n - 1, 1);
        root.style.setProperty('--p-wipe', String(r));
        root.style.setProperty('--p-scale', String(1 - 0.1 * r));
        root.style.setProperty('--p-settle', '0px');
        wrap.style.backgroundColor = 'var(--color-sand)';
        themeOn(r < 0.999);
        navClip(r);
        stopAuto(); clearTimeout(idleT);
      } else {
        root.style.setProperty('--p-wipe', '1'); root.style.setProperty('--p-scale', '.9'); root.style.setProperty('--p-settle', '0px');
        wrap.style.backgroundColor = 'var(--color-sand)';
        themeOn(false);
        navClip(1);
        stopAuto(); clearTimeout(idleT);
      }
    },
    onToggle: (s) => {
      s.isActive ? document.body.setAttribute('data-tone-hold', '') : document.body.removeAttribute('data-tone-hold');
    },
    onEnter: (s) => { inside = true; inStage(true); if (s.progress <= dEnd) armAuto(); },
    onEnterBack: (s) => { inside = true; inStage(true); if (s.progress <= dEnd) armAuto(); },
    onLeave: () => { inside = false; stopAuto(); clearTimeout(idleT); themeOn(false); navClip(1); },
    onLeaveBack: () => {
      inside = false; stopAuto(); clearTimeout(idleT); inStage(false);
      if (!reduced) root.style.setProperty('--p-settle', settle(15));
      root.style.setProperty('--p-wipe', '0'); root.style.setProperty('--p-scale', '1');
      navClip(0);
    },
  });

  // Hero visual rises with the section as it scrolls into view.
  const rise = () => {
    const top = wrap.getBoundingClientRect().top, h = window.innerHeight || 1;
    let yp: number;
    if (top >= h) yp = 100;
    else if (top > 0) { const e = 1 - top / h; yp = 100 * (1 - (1.26 * e * e - 0.44 * e * e * e)); }
    else { const e = Math.min(1, ((-top / h) * 100) / 30); yp = 18 * (1 - e) * (1 - e); }
    gsap.set(heroes, { y: 0, yPercent: reduced ? 0 : yp, opacity: 1 });
  };
  ScrollTrigger.create({ trigger: wrap, start: 'top bottom', end: 'top top', onUpdate: () => { rise(); alignGrain(); }, onLeave: () => gsap.set(heroes, { yPercent: 18 }), onLeaveBack: () => gsap.set(heroes, { yPercent: 100 }) });
  rise();

  // Pebble backdrop under the stage while it's on screen (hides the page bg seams).
  if (pebble) {
    const vis = () => {
      const r = wrap.getBoundingClientRect(), h = window.innerHeight;
      gsap.set(pebble, { autoAlpha: r.top < h && r.bottom > 0 && r.bottom > h ? 1 : 0 });
    };
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: vis });
    ScrollTrigger.addEventListener('refresh', vis);
    vis();
  }

  // Dots: jump to a partner.
  dots.forEach((d, i) => d.addEventListener('click', () => {
    stopAuto();
    dir = i > active ? 'down' : 'up';
    const top = wrap.getBoundingClientRect().top + window.scrollY;
    const len = wrap.offsetHeight - window.innerHeight;
    const y = (k: number) => top + (k / n) * dEnd * len;
    const cur = y(active + Math.min(0.98, slideP));
    if (Math.abs(window.scrollY - cur) > 2) scrollToY(cur, { immediate: true });
    scrollToY(y(i + 0.5), { duration: 0.7 });
  }));

  // Pointer parallax on the hero visual.
  if (!reduced && window.matchMedia('(pointer: fine)').matches) {
    const qx = gsap.quickTo(heroes, 'x', { duration: 1.4, ease: 'power3.out' });
    let on = false;
    ScrollTrigger.create({ trigger: wrap, start: 'top bottom', end: 'bottom top', onToggle: (s) => { on = s.isActive; if (!on) qx(0); } });
    window.addEventListener('pointermove', (e) => { if (on) qx(-34 * ((e.clientX / window.innerWidth) * 2 - 1)); }, { passive: true });
  }

  // Depth slides (WebGL) + paired prints following the pointer.
  heroEls.forEach((h, i) => {
    const c = $<HTMLCanvasElement>('[data-pt-gl]', h);
    if (c) {
      import('@valtier/ds/motion/depth-gl').then(async ({ createDepthSlide }) => {
        const d = await createDepthSlide(c, {
          src: c.dataset.src!, depth: c.dataset.depth!, aspect: parseFloat(c.dataset.aspect || '1.7778'), overscan: 1, reduced,
          onReady: () => c.parentElement?.setAttribute('data-gl', ''),
        });
        depth[i] = d;
        d?.setActive(i === active);
      });
    }
    const pair = $('[data-pt-pair]', h);
    if (pair && !reduced) pairFollow(pair, () => active === i);
  });
  window.addEventListener('resize', () => { alignGrain(); ScrollTrigger.refresh(); });
  void lastScroll;
}

function pairFollow(pair: HTMLElement, isActive: () => boolean) {
  const back = $('[data-pair-back]', pair), front = $('[data-pair-front]', pair);
  if (!back || !front) return;
  const s = { tx: 0, ty: 0, cx: 0, cy: 0 };
  window.addEventListener('pointermove', (e) => { s.tx = (e.clientX / window.innerWidth) * 2 - 1; s.ty = (e.clientY / window.innerHeight) * 2 - 1; }, { passive: true });
  const tick = () => {
    const on = isActive();
    const tx = on ? s.tx : 0, ty = on ? s.ty : 0;
    s.cx += (tx - s.cx) * 0.055; s.cy += (ty - s.cy) * 0.055;
    front.style.transform = `translate3d(${(20 * s.cx).toFixed(2)}px, ${(12 * s.cy).toFixed(2)}px, 0) rotate(${(-4 + 1.4 * s.cx).toFixed(2)}deg)`;
    back.style.transform = `translate3d(${(-13 * s.cx).toFixed(2)}px, ${(-8 * s.cy).toFixed(2)}px, 0) rotate(${(2.5 - s.cx).toFixed(2)}deg)`;
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !running) { running = true; requestAnimationFrame(tick); } });
  let running = false;
  io.observe(pair);
}

/* ---------------------------------------------------------------- phones */
function initRail() {
  const sec = $('[data-pt-rail]');
  if (!sec) return;
  const list = $('[data-ptr-list]', sec)!;
  const arts = $$('[data-ptr-art]', sec);
  const fills = $$('[data-ptr-fill]', sec);
  const dots = $$('[data-ptr-dot]', sec);
  const word = $('[data-ptr-word]', sec)!;
  const head = word.parentElement!;
  const n = arts.length;
  const reduced = prefersReducedMotion();
  fitHeadline(head, word, '--ptr-fs', () => Math.min(head.clientWidth, Math.max(window.innerHeight || head.clientWidth, 640)));
  const panel = $('.ptr__panel', sec);
  if (panel) sec.style.setProperty('--ptr-panel-h', `${panel.offsetHeight}px`);

  const at = () => {
    const a = list.children[0] as HTMLElement, b = list.children[1] as HTMLElement;
    if (!a || !b) return 0;
    return list.scrollLeft / (b.offsetLeft - a.offsetLeft || 1);
  };
  let cur = 0, auto = 0, lastInteract = performance.now(), visible = false, last = 0;
  const paint = () => {
    const x = at(), k = Math.max(0, Math.min(n - 1, Math.round(x)));
    arts.forEach((el, i) => {
      const o = Math.max(0, 1 - Math.abs(x - i));
      el.style.opacity = o.toFixed(3);
      el.style.visibility = o > 0 ? '' : 'hidden';
    });
    if (k !== cur) { cur = k; auto = 0; }
    dots.forEach((d, i) => (i === k ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
    fills.forEach((f, i) => (f.style.transform = `translate3d(${(((i === k ? auto : 0) - 1) * 100).toFixed(2)}%, 0, 0)`));
  };
  const go = (i: number) => {
    const el = list.children[(i + n) % n] as HTMLElement;
    list.scrollTo({ left: el.offsetLeft - list.offsetLeft - parseFloat(getComputedStyle(list).paddingLeft || '0') + 0, behavior: reduced ? 'auto' : 'smooth' });
  };
  list.addEventListener('scroll', () => { lastInteract = performance.now(); paint(); }, { passive: true });
  dots.forEach((d, i) => d.addEventListener('click', () => { lastInteract = performance.now(); auto = 0; go(i); }));
  ['touchstart', 'pointerdown'].forEach((e) => sec.addEventListener(e, () => (lastInteract = performance.now()), { passive: true }));
  if (!reduced && n > 1) {
    new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; if (visible) { last = performance.now(); requestAnimationFrame(loop); } }, { threshold: 0.5 }).observe(list);
    const loop = (now: number) => {
      if (!visible) return;
      const dt = Math.min(100, now - last); last = now;
      if (now - lastInteract > IDLE_MS) {
        auto = Math.min(1, auto + dt / AUTO_MS);
        paint();
        if (auto >= 1) { auto = 0; lastInteract = now; go((cur + 1) % n); }
      }
      requestAnimationFrame(loop);
    };
  }
  paint();
}

/* ---------------------------------------------------------------- foundation */
function initFoundation() {
  const tiles = $$('[data-fnd-tile]');
  tiles.forEach((t, i) => {
    const activate = () => {
      if (t.hasAttribute('data-active')) return false;
      tiles.forEach((x) => x.toggleAttribute('data-active', x === t));
      sound.tab?.(0.8);
      return true;
    };
    t.addEventListener('mouseenter', activate);
    t.addEventListener('focus', activate);
    t.addEventListener('click', (e) => { if (window.matchMedia('(hover: none)').matches && activate()) e.preventDefault(); });
    void i;
  });
  const rail = $('[data-fnd-rail]');
  if (rail && isPhone()) {
    import('@valtier/ds/motion/snap-rail').then(({ initSnapRail }) => {
      const items = Array.from(rail.children) as HTMLElement[];
      initSnapRail(rail, { onActive: (i) => items.forEach((el, k) => el.setAttribute('aria-current', String(k === i))) });
    });
  }
}
