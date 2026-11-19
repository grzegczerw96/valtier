/** Home stage choreography (see HomeStage.astro).
 *
 *  Timeline of the pinned desktop scene (scrubbed, units = share of the stage's
 *  scroll length; total 0.615 like the reference):
 *    0     – .215  --wipe 0→1: the hero tilts up and away on a slanted cut
 *    0     – .615  moment cards travel in from the right, yard lines at .45×
 *    .02   – .15   the hero's rookie card flies (and spins 360°) into slot one
 *    .4    – .492  stage light fades;  .431 – .493 headline + yard lines fade
 *    .492  – .615  backdrop ink → purple fog
 *  The quote then zooms out of a dot matrix over .66 – 1.0 of the stage. */
import { gsap, ScrollTrigger } from '@valtier/ds/motion/gsap';
import { isPhone, prefersReducedMotion, pageX, CONTENT_MAX, clamp01 } from '@valtier/ds/motion/env';
import { afterVeil, holdVeil } from '@valtier/ds/motion/veil';
import { scrollToY, lockScroll, unlockScroll, isScrollLocked, setScrollScale } from '@valtier/ds/motion/scroll';
import { slantClip, slantAngle } from '@valtier/ds/motion/slant';
import { attachTilt, TILT_VARS } from '@valtier/ds/motion/tilt';
import { createDotZoom } from '@valtier/ds/motion/dot-zoom';
import { sound } from '@valtier/ds/motion/sound';
import { hero as heroContent } from '../../content/home';

const STAGE = { total: 0.615, wipe: 0.215, flight: [0.02, 0.13] as const, theme: 0.32, quote: [0.66, 1] as const };
const pageW = () => Math.min(window.innerWidth, CONTENT_MAX);
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll<T>(s));
const setTheme = (t: string) => {
  if (document.body.hasAttribute('data-footer-dark')) return;
  if (document.body.getAttribute('data-theme') !== t) document.body.setAttribute('data-theme', t);
};

export function initHomeStage() {
  const stage = $('[data-home-stage]');
  if (!stage) return;
  const phone = isPhone();
  const reduced = prefersReducedMotion();
  const hero = initHero(stage, phone, reduced);
  if (phone) initPhoneMoments(stage);
  else initDesktopStage(stage, reduced, hero);
}

/* ========================================================================== */
/* HERO                                                                        */
/* ========================================================================== */

interface HeroApi { landed: () => boolean; zoomIn: () => void }

function initHero(stage: HTMLElement, phone: boolean, reduced: boolean): HeroApi {
  const section = $('[data-hero]', stage)!;
  const video = $<HTMLVideoElement>('[data-hero-video]', section)!;
  const canvas = $<HTMLCanvasElement>('[data-hero-gl]', section)!;
  const chrome = $$('[data-hero-chrome] > *', section);
  const wordmark = $('[data-hero-wordmark]', section)!;
  const navLogo = $$('[data-nav] > a');
  const navBurger = $$('[data-nav] > button');
  const chars = $$('[data-hero-copy] [data-ch]', section);
  const charsPh = $$('[data-hero-copy-ph] [data-ch]', section);
  const sigs = $$('[data-signature]', section);
  const card = $('[data-hero-card]', section);
  const hint = $('[data-hero-hint]', section);
  const zoomBtn = $<HTMLButtonElement>('[data-hero-zoom]', section);
  const zoomOutBtn = $<HTMLButtonElement>('[data-hero-zoom-out]', section);

  const intro = {
    progress: 0, heroAlpha: 1, startScale: 12.6, endScale: 0.85, lensYOffset: 0.22,
    diveStartW: 1, diveSpan: 0.7, warpAmplitude: 0.45, crtScale: 1,
  };
  let landed = false;
  let glOk = false;

  const finish = () => {
    landed = true;
    section.setAttribute('data-intro-done', '');
    sigs.forEach((s) => (s.dataset.active = 'true'));
    if (zoomBtn && glOk && !reduced) zoomBtn.hidden = false;
  };
  const showFinal = () => {
    intro.progress = 1;
    gsap.set([...chrome, wordmark], { autoAlpha: 1, y: 0 });
    gsap.set([...navLogo, ...navBurger], { autoAlpha: 1, x: 0 });
    chars.forEach((c) => (c.style.visibility = ''));
    charsPh.forEach((c) => (c.style.opacity = ''));
    finish();
  };

  if (card) attachTilt(card);

  // Video: attach early (the loader waits for the first frame).
  const src = phone ? video.dataset.srcPhone || video.dataset.src! : video.dataset.src!;
  video.muted = true; video.defaultMuted = true; video.playsInline = true;
  video.src = src;
  video.preload = 'auto';
  const play = () => { if (!reduced && !document.hidden) video.play().catch(() => {}); };
  ['canplay', 'loadedmetadata'].forEach((e) => video.addEventListener(e, play));
  document.addEventListener('visibilitychange', () => (document.hidden ? video.pause() : play()));
  ['pointerdown', 'touchend', 'keydown'].forEach((e) => document.addEventListener(e, play, { passive: true, once: true }));
  play();

  // WebGL portrait. The loader is held until its first frame (or failure).
  const { endScale, diveStartW, diveSpan } = portraitFitLocal(phone);
  Object.assign(intro, { endScale, diveStartW, diveSpan });
  let resolveReady!: () => void;
  const ready = new Promise<void>((r) => (resolveReady = r));
  holdVeil(Promise.race([ready, new Promise((r) => setTimeout(r, 9000))]));
  const fail = () => {
    glOk = false;
    section.removeAttribute('data-gl-ready');
    canvas.style.display = 'none';
    video.pause();
    resolveReady();
  };
  import('@valtier/ds/motion/depth-gl').then(({ createDepthPortrait }) =>
    createDepthPortrait(canvas, {
      diffuse: heroContent.portrait.diffuse,
      depth: heroContent.portrait.depth,
      lens: heroContent.portrait.lens,
      video,
      aspect: heroContent.portrait.width / heroContent.portrait.height,
      lensCenter: heroContent.portrait.lensCenter,
      phone, reduced, intro,
      paused: () => (parseFloat(document.documentElement.style.getPropertyValue('--wipe')) || 0) >= 0.999,
      onReady: () => { glOk = true; section.setAttribute('data-gl-ready', ''); resolveReady(); },
      onFail: fail,
    }),
  ).then((p) => { if (!p) fail(); }, fail);
  window.addEventListener('resize', () => { intro.endScale = portraitFitLocal(phone).endScale; });

  // Initial (hidden) state of the chrome, then the intro after the loader.
  if (reduced) {
    ready.then(showFinal);
  } else {
    gsap.set(chrome, { autoAlpha: 0 });
    gsap.set(wordmark, { autoAlpha: 0, y: -8 });
    gsap.set(navLogo, { autoAlpha: 0, x: -32 });
    gsap.set(navBurger, { autoAlpha: 0, x: 32 });
    Promise.all([ready, new Promise<void>((r) => afterVeil(r))]).then(() => {
      if (!glOk) return showFinal();
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
      tl.to(intro, { progress: 0.4, duration: 1.2, ease: 'sine.inOut' }, 1);
      tl.to(intro, { progress: 1, duration: phone ? 2.1 : 1.8, ease: 'power3.out', onComplete: finish }, 2.2);
      tl.call(() => sigs.forEach((s) => (s.dataset.active = 'true')), undefined, 2.9);
      tl.to(chrome, { autoAlpha: 1, duration: 1.4, ease: 'power2.out' }, 2.9);
      tl.to(wordmark, { autoAlpha: 1, y: 0, duration: 1.4, ease: 'power2.out' }, 2.9);
      tl.to(navLogo, { autoAlpha: 1, x: 0, duration: 1.4, ease: 'power3.out' }, 3.2);
      tl.to(navBurger, { autoAlpha: 1, x: 0, duration: 1.4, ease: 'power3.out' }, 3.2);
      const shown = { n: 0 };
      tl.to(shown, {
        n: chars.length, duration: 2.2, ease: 'none',
        onUpdate: () => {
          const k = Math.round(shown.n);
          chars.forEach((c, i) => (c.style.visibility = i < k ? 'visible' : 'hidden'));
          charsPh.forEach((c, i) => (c.style.opacity = String(clamp01((shown.n - i) / 2))));
        },
      }, 3.3);
    });
  }

  /* ---- zoom into the glasses (scroll up at the top / click the lenses) ---- */
  let mode: 'rest' | 'zoom' = 'rest';
  let acc = 0, lastWheel = 0, atTopSince = 0, zt: gsap.core.Tween | null = null, ft: gsap.core.Tween | null = null;
  const chromeEls = () => [...chrome, wordmark, ...navLogo, ...navBurger];
  const zoomIn = () => {
    if (!landed || !glOk || reduced || mode === 'zoom') return;
    const go = () => {
      mode = 'zoom';
      acc = 0;
      lockScroll();
      ft?.kill();
      ft = gsap.to(chromeEls(), { autoAlpha: 0, duration: 0.45, ease: 'power2.out', overwrite: 'auto' });
      zt?.kill();
      zt = gsap.to(intro, { progress: 0, duration: 1.6, ease: 'power2.inOut' });
      if (zoomBtn) zoomBtn.hidden = true;
      if (zoomOutBtn) zoomOutBtn.hidden = false;
      setTimeout(() => mode === 'zoom' && hint?.setAttribute('data-on', ''), 1700);
      const label = hint?.querySelector('[data-hint-label]');
      if (label) label.textContent = window.matchMedia('(hover: none)').matches ? 'Swipe' : 'Scroll';
    };
    if (window.scrollY > 1) { scrollToY(0, { duration: 0.9 }); setTimeout(go, 900); } else go();
  };
  const zoomOut = () => {
    if (mode !== 'zoom') return;
    hint?.removeAttribute('data-on');
    zt?.kill();
    zt = gsap.to(intro, {
      progress: 1, duration: 1.2, ease: 'power2.inOut',
      onComplete: () => {
        mode = 'rest';
        unlockScroll();
        ft?.kill();
        ft = gsap.to(chromeEls(), { autoAlpha: 1, duration: 0.6, ease: 'power2.out', overwrite: 'auto' });
        if (zoomOutBtn) zoomOutBtn.hidden = true;
        if (zoomBtn) zoomBtn.hidden = false;
      },
    });
  };
  zoomBtn?.addEventListener('click', zoomIn);
  zoomOutBtn?.addEventListener('click', zoomOut);
  if (!reduced) {
    let wasTop = window.scrollY <= 1;
    window.addEventListener('scroll', () => {
      const top = window.scrollY <= 1;
      if (top && !wasTop) { atTopSince = performance.now(); acc = 0; }
      wasTop = top;
    }, { passive: true });
    window.addEventListener('wheel', (e) => {
      const now = performance.now(), d = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      if (now - lastWheel > 220) acc = 0;
      lastWheel = now;
      if (mode === 'zoom') {
        e.preventDefault(); e.stopPropagation();
        if (zt?.isActive()) return;
        if (d > 0 && (acc += d) >= 90) zoomOut();
        return;
      }
      if (!landed || window.scrollY > 1 || isScrollLocked()) return;
      if (d >= 0) { acc = 0; return; }
      e.preventDefault(); e.stopPropagation();
      if (now - atTopSince < 250) return;
      if ((acc += -d) >= 240) zoomIn();
    }, { capture: true, passive: false });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') zoomOut(); });
    let ty: number | null = null;
    window.addEventListener('touchstart', (e) => { ty = e.touches[0]?.clientY ?? null; if (mode === 'zoom') acc = 0; }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (mode !== 'zoom' || ty == null) return;
      const y = e.touches[0]?.clientY;
      if (y == null) return;
      const d = ty - y; ty = y;
      if (!zt?.isActive() && d > 0 && (acc += d) >= 90) zoomOut();
    }, { passive: true });
  }

  return { landed: () => landed, zoomIn };
}

function portraitFitLocal(phone: boolean) {
  if (phone) return { endScale: 0.74, diveStartW: 1.8, diveSpan: 0.82 };
  const t = Math.tan((19 * Math.PI) / 360) * 2.65, e = 0.85;
  const r = (t - (-0.06 + 0.22 * (1 - e) - e / 2) - (2 * t * 86) / window.innerHeight) / 0.912;
  return { endScale: Math.min(e, Math.max(0.6, r)), diveStartW: 1, diveSpan: 0.7 };
}

/* ========================================================================== */
/* DESKTOP STAGE                                                               */
/* ========================================================================== */

function initDesktopStage(stage: HTMLElement, reduced: boolean, hero: HeroApi) {
  const pin = $('[data-home-pin]', stage)!;
  const heroFade = $('[data-hero-fade]', stage)!;
  const cards = $('[data-sm-cards]', stage)!;
  const yards = $('[data-sm-yards]', stage);
  const backdrop = $('[data-sm-backdrop]', stage);
  const headline = $('[data-sm-headline]', stage);
  const light = $('[data-sm-light]', stage);
  const nav = $('[data-nav]');
  const wipeNav = $('[data-home-wipe-nav]');
  const root = document.documentElement;
  const cardEls = $$('[data-sm-card]', cards);

  let paneH = pin.offsetHeight || window.innerHeight;
  let W = heroFade.clientWidth;
  let navH = nav?.offsetHeight ?? 0, dupH = wipeNav?.offsetHeight ?? 0;
  const X = () => Math.max(1, stage.offsetHeight - paneH);
  const measure = () => {
    paneH = pin.offsetHeight || window.innerHeight;
    W = heroFade.clientWidth;
    navH = nav?.offsetHeight ?? 0;
    dupH = wipeNav?.offsetHeight ?? 0;
  };
  document.body.classList.add('home-stage-on');

  /* ---- wipe: hero angle + nav clipping ---- */
  const applyWipe = () => {
    const t = parseFloat(root.style.getPropertyValue('--wipe')) || 0;
    heroFade.style.setProperty('--wipe-angle', `${slantAngle(t, W, paneH)}rad`);
    if (nav) nav.style.clipPath = t <= 0 || t >= 1 ? '' : slantClip(t, W, navH, paneH, true);
    if (wipeNav) wipeNav.style.setProperty('--wipe-nav-clip', t <= 0 || t >= 1 ? 'polygon(0 0, 0 0, 0 0)' : slantClip(t, W, dupH, paneH, false));
  };

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: stage, start: () => (measure(), 'top top'), end: 'bottom bottom', scrub: 0.3, invalidateOnRefresh: true },
  });
  tl.fromTo(root, { '--wipe': 0 }, { '--wipe': 1, duration: STAGE.wipe, onUpdate: applyWipe }, 0);
  applyWipe();
  tl.fromTo(cards, { x: () => pageX() + pageW() }, { x: () => pageX() - cards.scrollWidth - 0.5 * pageW(), duration: STAGE.total }, 0);
  if (yards) tl.fromTo(yards, { x: 0 }, { x: () => -0.45 * (cards.scrollWidth + 1.5 * pageW()), duration: STAGE.total }, 0);
  if (light) tl.fromTo(light, { '--sm-light-fade': 1 }, { '--sm-light-fade': 0, duration: 0.092 }, 0.4);
  if (yards) tl.to(yards, { opacity: 0, duration: 0.062 }, 0.431);
  if (headline) tl.to(headline, { opacity: 0, duration: 0.062 }, 0.431);
  if (backdrop) tl.fromTo(backdrop, { backgroundColor: '#171220' }, { backgroundColor: '#563B80', duration: 0.123 }, 0.492);
  cards.dataset.cardsWindow = String(STAGE.total / tl.duration());

  /* ---- theme: light hero until 32% of the stage, then dark ---- */
  ScrollTrigger.create({
    trigger: stage,
    start: 'top top',
    end: 'bottom bottom',
    onToggle: (s) => (s.isActive ? document.body.setAttribute('data-tone-hold', '') : document.body.removeAttribute('data-tone-hold')),
    onUpdate: (s) => {
      const dark = s.progress >= STAGE.theme;
      setTheme(dark ? 'tone-dark' : 'tone-light');
      heroFade.style.visibility = dark && s.progress > STAGE.wipe / STAGE.total ? 'hidden' : '';
    },
  });
  setTheme('tone-light');

  /* ---- per-card pose: position tilt + cursor hover ---- */
  let raf = 0, mx = -1, my = -1, activeCard: number | null = null;
  const pose = () => {
    raf = 0;
    if (activeCard !== null) return;
    const w = window.innerWidth, h = window.innerHeight, cx0 = w / 2, cy0 = h / 2, px = pageX(w), pw = pageW();
    cardEls.forEach((el, n) => {
      const box = $('[data-card-box]', el)!;
      const r = box.getBoundingClientRect();
      if (r.right < -80 || r.left > w + 80) return;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const v = Math.max(-1, Math.min(1, ((cx - px) / pw - 0.5) * 2));
      el.style.setProperty('--ry-pos', `${v * (20 + ((7 * n) % 3) * 6)}deg`);
      el.style.setProperty('--rz', `${3.5 * v + 2.4 * (n % 2 === 0 ? 1 : -1) * (1 - Math.abs(v))}deg`);
      const m = 1 - Math.abs(v);
      let f = 0, gy = 0, gx = 0;
      if (mx >= 0) {
        const nx = (mx - r.left) / r.width, ny = (my - r.top) / r.height;
        f = clamp01(1 - Math.hypot(nx < 0 ? -nx : nx > 1 ? nx - 1 : 0, ny < 0 ? -ny : ny > 1 ? ny - 1 : 0) / 0.6);
        el.style.setProperty('--mxf', String(clamp01(nx)));
        gy = Math.max(-1, Math.min(1, (my - cy) / cy0));
        gx = Math.max(-1, Math.min(1, (mx - cx) / cx0));
      }
      el.style.setProperty('--hover', f.toFixed(3));
      const b = 0.35 + 0.65 * f;
      el.style.setProperty('--ry-cursor', `${13 * gx * b}deg`);
      el.style.setProperty('--rx', `${-9 * gy * b}deg`);
      el.style.setProperty('--scale', ((0.94 + 0.1 * m) * (1 + 0.05 * f)).toFixed(4));
      el.style.setProperty('--tz', `${(34 * m + 46 * f).toFixed(1)}px`);
    });
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(pose); };
  window.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; schedule(); }, { passive: true });
  window.addEventListener('scroll', schedule, { passive: true });
  schedule();

  /* ---- the hero card flies into slot one ---- */
  const heroCard = $('[data-hero-card]');
  const flight = $('[data-flight]', stage);
  const spin = $('[data-flight-spin]', stage);
  const slot = $('[data-card-box]', cardEls[0]);
  const slot3d = slot ? $('[data-card-3d]', slot) : null;
  if (heroCard && flight && spin && slot && slot3d && !reduced) {
    const ease = gsap.parseEase('power2.inOut');
    const f = { p: 0 };
    let fw = 0, fh = 0, inFlight = false, fr = 0;
    const num = (el: HTMLElement, k: string, d = 0) => { const v = parseFloat(el.style.getPropertyValue(k)); return Number.isFinite(v) ? v : d; };
    const hide = () => { flight.style.visibility = 'hidden'; flight.style.pointerEvents = 'none'; };
    const land = () => { if (inFlight) { inFlight = false; requestAnimationFrame(() => requestAnimationFrame(() => (slot3d.style.transition = ''))); } };
    const step = () => {
      const p = f.p;
      const hr = heroCard.getBoundingClientRect();
      if (!hr.width || activeCard !== null) { land(); hide(); slot.style.visibility = ''; return; }
      if (p <= 0 || p >= 1) {
        land();
        heroCard.style.visibility = p >= 1 ? 'hidden' : '';
        hide();
        slot.style.visibility = p >= 1 ? '' : 'hidden';
        if (p <= 0) TILT_VARS.forEach((k) => heroCard.style.removeProperty(k));
        return;
      }
      const sr = slot.getBoundingClientRect(), pr = pin.getBoundingClientRect();
      const cs = getComputedStyle(slot);
      const w0 = parseFloat(cs.width) || 0, h0 = parseFloat(cs.height) || 0;
      if (w0 !== fw || h0 !== fh) { fw = w0; fh = h0; flight.style.width = `${w0}px`; flight.style.height = `${h0}px`; }
      if (!fw || !fh) { hide(); return; }
      if (!inFlight) { inFlight = true; slot3d.style.transition = 'none'; }
      const v = ease(p), e = 1 - v;
      heroCard.style.visibility = 'hidden';
      slot.style.visibility = 'hidden';
      flight.style.visibility = '';
      flight.style.pointerEvents = 'auto';
      const x = hr.left + (sr.left - hr.left) * v, y = hr.top + (sr.top - hr.top) * v;
      const w = hr.width + (sr.width - hr.width) * v, h = hr.height + (sr.height - hr.height) * v;
      flight.style.transform = `translate(${x - pr.left + (w - fw) / 2}px, ${y - pr.top + (h - fh) / 2}px)`;
      const sx = w / fw, sy = h / fh;
      const c0 = cardEls[0];
      const tz = num(heroCard, '--tz') * e + num(c0, '--tz') * v;
      const rx = num(heroCard, '--rx') * e + num(c0, '--rx') * v;
      const ry = 360 * v + num(heroCard, '--ry-cursor') * e + (num(c0, '--ry-pos') + num(c0, '--ry-cursor')) * v;
      const rz = num(c0, '--rz') * v;
      const sc = (1 + (num(heroCard, '--scale', 1) - 1) * e) * (1 + (num(c0, '--scale', 1) - 1) * v);
      spin.style.transform = `translateZ(${tz}px) scale3d(${sx}, ${sy}, ${(sx + sy) / 2}) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${sc})`;
    };
    const loop = () => { fr = 0; step(); if (f.p > 0 && f.p < 1) fr = requestAnimationFrame(loop); };
    tl.fromTo(f, { p: 0 }, { p: 1, duration: STAGE.flight[1], ease: 'none', onUpdate: () => { step(); if (!fr && f.p > 0 && f.p < 1) fr = requestAnimationFrame(loop); } }, STAGE.flight[0]);
    ScrollTrigger.addEventListener('refresh', step);
    // Clicking the hero card scrolls the stage until the card has landed, then opens it.
    const toSlot = () => {
      const st = tl.scrollTrigger!;
      const y = st.start + (st.end - st.start) * (0.15 / tl.duration() + 0.01);
      const d = Math.min(2.4, 0.6 + Math.abs(y - window.scrollY) / 1100);
      scrollToY(y, { duration: d });
      setTimeout(() => openCard(0), d * 1000 + 120);
    };
    heroCard.addEventListener('click', toSlot);
    heroCard.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toSlot(); } });
    flight.addEventListener('click', toSlot);
    step();
  } else if (heroCard) {
    heroCard.addEventListener('click', () => scrollToY(stage.offsetTop + X() * 0.25, { duration: 1.2 }));
  }

  /* ---- open a card: flip to its video ---- */
  const openState = new WeakMap<HTMLElement, gsap.core.Tween>();
  const getOpen = (el: HTMLElement) => {
    const g = (k: string, d: number) => { const v = parseFloat(el.style.getPropertyValue(k)); return Number.isFinite(v) ? v : d; };
    return { s: g('--open-scale', 1), ry: g('--open-ry', 0), rz: g('--open-rz', 0), ty: g('--open-ty', 0), fw: g('--open-fw', 1), fh: g('--open-fh', 1) };
  };
  const tweenOpen = (el: HTMLElement, to: Record<string, number>, dur: number, ease: string, done?: () => void) => {
    openState.get(el)?.kill();
    const s = getOpen(el);
    const t = gsap.to(s, {
      ...to, duration: reduced ? 0 : dur, ease,
      onUpdate: () => {
        el.style.setProperty('--open-scale', String(s.s)); el.style.setProperty('--open-ry', String(s.ry));
        el.style.setProperty('--open-rz', String(s.rz)); el.style.setProperty('--open-ty', String(s.ty));
        el.style.setProperty('--open-fw', String(s.fw)); el.style.setProperty('--open-fh', String(s.fh));
      },
      onComplete: done,
    });
    openState.set(el, t);
  };
  const fitFor = (i: number) => {
    const box = $('[data-card-box]', cardEls[i])!;
    const v = $<HTMLVideoElement>('video', cardEls[i]);
    const va = v && v.videoWidth ? v.videoWidth / v.videoHeight : 16 / 9;
    const bw = box.offsetWidth || 1, bh = box.offsetHeight || 1;
    const a = (va * bw) / bh, fw = a >= 1 ? 1 / a : 1, fh = a >= 1 ? 1 : a;
    return { s: Math.min((0.7 * pageW()) / (bh * fh), (0.74 * window.innerHeight) / (bw * fw)), fw, fh };
  };
  const cardScrollY = (i: number) => {
    const box = $('[data-card-box]', cardEls[i])!;
    const r = box.getBoundingClientRect();
    const k = (-cards.scrollWidth - 1.5 * pageW()) / ((parseFloat(cards.dataset.cardsWindow || '1') || 1) * X());
    return Math.max(0, window.scrollY + (window.innerWidth / 2 - (r.left + r.width / 2)) / k);
  };
  const setPlayer = (i: number, on: boolean) => {
    const el = cardEls[i];
    const player = $('[data-card-player]', el)!;
    const v = $<HTMLVideoElement>('video', player)!;
    const title = $('[data-card-title]', el);
    el.style.zIndex = on ? '50' : '';
    el.style.position = on ? 'relative' : '';
    const box = $('[data-card-box]', el)!;
    box.style.animationPlayState = on ? 'paused' : '';
    if (title) title.style.opacity = on ? '0' : '';
    if (on) {
      player.hidden = false;
      if (!v.getAttribute('src')) v.src = v.dataset.src!;
      v.muted = false;
      v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    } else {
      v.muted = true; v.pause();
    }
  };
  const shift = (i: number | null) => cardEls.forEach((el, n) => {
    el.style.transform = i === null || n === i ? '' : `translateX(calc(${(n < i ? -1 : 1) * 15} * var(--page-w) / 100))`;
  });
  function openCard(i: number) {
    if (activeCard === i) return closeCard();
    const prev = activeCard;
    if (prev !== null) { setPlayer(prev, false); const p = cardEls[prev]; tweenOpen(p, { s: 1, ry: 0, rz: 0, ty: 0, fw: 1, fh: 1 }, 0.45, 'power2.inOut', () => { p.style.zIndex = ''; p.style.position = ''; $('[data-card-player]', p)!.hidden = true; }); }
    activeCard = i;
    const el = cardEls[i];
    const box = $('[data-card-box]', el)!;
    const r = box.getBoundingClientRect();
    ['--tz', '--rx', '--ry-pos', '--ry-cursor', '--rz'].forEach((k) => el.style.setProperty(k, k === '--tz' ? '0px' : '0deg'));
    el.style.setProperty('--scale', '1'); el.style.setProperty('--hover', '0');
    cards.style.zIndex = '60';
    cards.setAttribute('data-active-card', String(i));
    shift(i);
    setPlayer(i, true);
    tweenOpen(el, { ry: 180, rz: 90, ty: window.innerHeight / 2 - (r.top + r.height / 2), ...fitFor(i) }, 0.75, 'power2.inOut');
    lockScrollSoon(cardScrollY(i));
    sound.card?.();
  }
  function closeCard() {
    const i = activeCard;
    if (i === null) return;
    activeCard = null;
    setPlayer(i, false);
    const el = cardEls[i];
    tweenOpen(el, { s: 1, ry: 0, rz: 0, ty: 0, fw: 1, fh: 1 }, 0.5, 'power2.in', () => {
      el.style.zIndex = ''; el.style.position = '';
      $('[data-card-player]', el)!.hidden = true;
      shift(null);
      cards.style.zIndex = '';
      cards.removeAttribute('data-active-card');
      unlockScroll();
      schedule();
    });
  }
  let lockT = 0;
  function lockScrollSoon(y: number) {
    clearTimeout(lockT);
    scrollToY(y, { duration: 0.7 });
    lockT = window.setTimeout(() => activeCard !== null && lockScroll(), 900);
  }
  cardEls.forEach((el, i) => {
    const box = $('[data-card-box]', el)!;
    box.addEventListener('click', (e) => {
      if (dragMoved) return;
      if ((e.target as Element).closest('[data-card-close]')) { closeCard(); return; }
      if (activeCard === i) {
        const v = $<HTMLVideoElement>('video', el)!;
        v.paused ? v.play().catch(() => {}) : v.pause();
        return;
      }
      openCard(i);
    });
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activeCard === i ? closeCard() : openCard(i); } });
    box.addEventListener('focus', () => {
      if (activeCard !== null || !box.matches(':focus-visible')) return;
      const r = box.getBoundingClientRect();
      if (r.left >= 0 && r.right <= window.innerWidth) return;
      scrollToY(cardScrollY(i), { duration: 0.6 });
    });
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCard(); });
  window.addEventListener('pointerdown', (e) => {
    if (activeCard === null) return;
    const t = e.target as Element;
    if (cardEls[activeCard].contains(t) || t.closest('[data-card-box]')) return;
    closeCard();
  });
  let wheelAcc = 0;
  window.addEventListener('wheel', (e) => { if (activeCard === null) return (wheelAcc = 0, undefined); if ((wheelAcc += Math.abs(e.deltaY)) > 170) { wheelAcc = 0; closeCard(); } }, { passive: true });

  /* ---- drag the rail (maps to scroll) ---- */
  let down = false, dragMoved = false, sx = 0, sy0 = 0, lastY = 0, lastT = 0, vel = 0;
  const k = () => (-cards.scrollWidth - 1.5 * pageW()) / ((parseFloat(cards.dataset.cardsWindow || '1') || 1) * X());
  window.addEventListener('pointerdown', (e) => {
    if (activeCard !== null || e.pointerType !== 'mouse' || e.button !== 0 || !stage.contains(e.target as Node)) return;
    const t = parseFloat(root.style.getPropertyValue('--wipe')) || 0;
    const pr = pin.getBoundingClientRect();
    const cut = pr.top + pr.height * (1 - t * (1.2 + 0.6 * (e.clientX / window.innerWidth)));
    if (e.clientY < cut) return;
    down = true; dragMoved = false; sx = e.clientX; lastY = sy0 = window.scrollY; lastT = performance.now(); vel = 0;
  });
  window.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - sx;
    if (!dragMoved && Math.abs(dx) > 6) { dragMoved = true; document.body.style.userSelect = 'none'; window.getSelection?.()?.removeAllRanges(); }
    if (!dragMoved) return;
    const y = Math.max(0, sy0 + dx / k()), now = performance.now(), dt = now - lastT;
    if (dt > 0) vel = (y - lastY) / dt;
    lastT = now; lastY = y;
    scrollToY(y, { immediate: true });
  });
  const up = () => {
    if (!down) return;
    down = false;
    document.body.style.userSelect = '';
    if (dragMoved) {
      setTimeout(() => (dragMoved = false), 0);
      if (Math.abs(vel) > 0.05) scrollToY(Math.max(0, lastY + 260 * vel), { duration: Math.min(1.1, 0.45 + 0.4 * Math.abs(vel)) });
    }
  };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);

  /* ---- quote: dot-matrix zoom over the last third of the stage ---- */
  const quote = $('[data-quote]');
  const qCanvas = $<HTMLCanvasElement>('[data-quote-canvas]', stage);
  if (quote && qCanvas) {
    const dz = createDotZoom({
      canvas: qCanvas,
      wrap: $('[data-quote-wrap]', quote)!,
      title: $('[data-quote-title]', quote)!,
      desc: $('[data-quote-desc]', quote),
      marks: $('[data-quote-marks]', quote),
      reduced,
    });
    let qp = 0;
    const dead = false;
    const render = (p: number) => {
      qp = p;
      quote.style.opacity = p > 0 ? '1' : '0';
      dz.render(p);
    };
    dz.measure();
    render(0);
    document.fonts?.ready.then(() => { if (!dead) { dz.measure(); render(qp); } });
    let rt = 0;
    window.addEventListener('resize', () => { if (!rt) rt = requestAnimationFrame(() => { rt = 0; dz.resize(); dz.measure(); render(qp); }); });
    ScrollTrigger.create({
      trigger: stage,
      start: () => (measure(), `top top-=${X() * STAGE.quote[0]}`),
      end: () => `top top-=${X() * STAGE.quote[1]}`,
      scrub: 0.3,
      invalidateOnRefresh: true,
      onUpdate: (s) => render(s.progress),
      onLeaveBack: () => render(0),
    });
    const qp2 = $('[data-section="quote-photos"]');
    if (qp2) {
      ScrollTrigger.create({
        trigger: qp2, start: 'bottom bottom', end: 'bottom top', scrub: 0.3,
        onUpdate: (s) => (quote.style.transform = `translateY(-${100 * s.progress}vh)`),
      });
    }
  }

  /* ---- slow the wheel while cards fly past (like the reference) ---- */
  ScrollTrigger.create({
    trigger: stage, start: 'top top', end: () => `top top-=${X() * 0.62}`,
    onToggle: (s) => setScrollScale(s.isActive ? 0.8 : 1),
  });

  window.addEventListener('resize', () => { measure(); applyWipe(); schedule(); });
  ScrollTrigger.addEventListener('refresh', () => { measure(); applyWipe(); });
  void hero;
}

/* ========================================================================== */
/* PHONE: moments rail                                                         */
/* ========================================================================== */

function initPhoneMoments(stage: HTMLElement) {
  const list = $('[data-sm-cards]', stage);
  if (!list) return;
  import('@valtier/ds/motion/snap-rail').then(({ initSnapRail }) => {
    const items = $$('[data-sm-card]', list);
    initSnapRail(list, {
      onActive: (i) => items.forEach((el, n) => el.setAttribute('aria-current', String(n === i))),
    });
  });
  // Tap a card: full-screen player.
  $$('[data-sm-card]', list).forEach((el) => {
    const box = $('[data-card-box]', el)!;
    const v = $<HTMLVideoElement>('video', el)!;
    box.addEventListener('click', () => openPhonePlayer(v.dataset.src!, $('.label', el)?.textContent ?? ''));
  });
}

function openPhonePlayer(src: string, title: string) {
  const d = document.createElement('div');
  d.className = 'phone-player';
  d.setAttribute('role', 'dialog');
  d.setAttribute('aria-modal', 'true');
  d.setAttribute('aria-label', title);
  d.innerHTML = `<video controls playsinline preload="auto" src="${src}"></video><button type="button" aria-label="Close video"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 2l10 10M12 2 2 12"/></svg></button>`;
  document.body.appendChild(d);
  const v = d.querySelector('video')!;
  const prev = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const close = () => { v.pause(); v.removeAttribute('src'); v.load(); d.remove(); document.body.style.overflow = prev; window.removeEventListener('keydown', esc); };
  const esc = (e: KeyboardEvent) => e.key === 'Escape' && close();
  window.addEventListener('keydown', esc);
  d.addEventListener('click', (e) => { if (e.target === d || (e.target as Element).closest('button')) close(); });
  v.play().catch(() => {});
}
