/** Features lane behaviour (see Features.astro). */
import { gsap, ScrollTrigger } from '@valtier/ds/motion/gsap';
import { isPhone, prefersReducedMotion } from '@valtier/ds/motion/env';
import { scrollToY } from '@valtier/ds/motion/scroll';
import { sound } from '@valtier/ds/motion/sound';
import { openFilm } from '@valtier/ds/motion/film';

const DESK = '(min-width: 1024px)';

export function initFeatures(root: HTMLElement) {
  const $$ = <T extends Element>(s: string) => Array.from(root.querySelectorAll<T>(s));
  const slides = $$<HTMLElement>('[data-feat-slide]');
  const texts = $$<HTMLElement>('[data-feat-text]');
  const lis = $$<HTMLElement>('[data-feat-li]');
  const links = $$<HTMLButtonElement>('.feat__link');
  const dots = $$<HTMLButtonElement>('.feat__dot');
  const stage = root.querySelector<HTMLElement>('[data-feat-stage]')!;
  const copy = root.querySelector<HTMLElement>('[data-feat-copy]')!;
  const progress = root.querySelector<HTMLElement>('[data-feat-progress]')!;
  const n = slides.length;
  const reduced = prefersReducedMotion();
  let desk = matchMedia(DESK).matches;
  let index = 0;
  let frac = 0;
  let dir: 'down' | 'up' = 'down';
  let pendingJump: number | null = null;

  /* ---- clips: load the active slide's loop (and its neighbours) ---------- */
  const loops = slides.map((s) => s.querySelector<HTMLVideoElement>('.feat__loop'));
  const syncLoops = () => {
    if (reduced) return;
    loops.forEach((v, i) => {
      if (!v) return;
      const near = Math.abs(i - index) <= 1;
      if (near && !v.getAttribute('src')) {
        v.src = v.dataset.src!;
        const ready = () => {
          if (v.readyState < 2) return;
          const show = () => v.classList.add('is-ready');
          if ('requestVideoFrameCallback' in v && !v.paused) (v as any).requestVideoFrameCallback(show);
          else requestAnimationFrame(() => requestAnimationFrame(show));
        };
        v.addEventListener('loadeddata', ready);
        v.addEventListener('playing', ready);
      }
      if (i === index && v.getAttribute('src')) v.play().catch(() => {});
      else if (!v.paused) v.pause();
    });
  };

  /* ---- inline player (desktop / tablet) ----------------------------------- */
  let inline: { slide: HTMLElement; video: HTMLVideoElement; io: IntersectionObserver } | null = null;
  const closeInline = () => {
    if (!inline) return;
    const { slide, video, io } = inline;
    inline = null;
    io.disconnect();
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
    slide.classList.remove('is-playing');
  };
  root.querySelectorAll<HTMLButtonElement>('[data-feat-play]').forEach((b) => b.addEventListener('click', () => {
    if (isPhone()) {
      openFilm({ src: b.dataset.src!, poster: b.dataset.poster, title: b.dataset.title || '' });
      return;
    }
    closeInline();
    const slide = b.closest<HTMLElement>('[data-feat-slide]')!;
    const video = document.createElement('video');
    video.className = 'feat__inline';
    video.controls = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = b.dataset.src!;
    video.setAttribute('aria-label', b.dataset.title || '');
    video.addEventListener('ended', closeInline);
    slide.append(video);
    slide.classList.add('is-playing');
    const io = new IntersectionObserver(([e]) => { if (e && e.intersectionRatio < 0.5) closeInline(); }, { threshold: [0, 0.5] });
    io.observe(slide);
    inline = { slide, video, io };
    video.play().catch(() => {});
  }));

  /* ---- progress line beside the index (desktop) --------------------------- */
  const placeProgress = () => {
    const a = lis[index];
    if (!a || !progress.offsetParent) return;
    const l = Math.max(0, Math.min(1, frac));
    const o = Math.max(0, Math.min(n - 1, index + l - 0.5));
    const i = lis[Math.floor(o)], s = lis[Math.min(Math.floor(o) + 1, n - 1)];
    const c = o - Math.floor(o);
    progress.style.top = `${i.offsetTop + c * (s.offsetTop - i.offsetTop)}px`;
    progress.style.height = `${a.offsetHeight}px`;
  };

  /* ---- switching ---------------------------------------------------------- */
  const show = (next: number) => {
    if (next === index) return;
    const prev = index;
    dir = next > prev ? 'down' : 'up';
    index = next;
    closeInline();
    slides.forEach((s, i) => {
      s.dataset.active = String(i === next);
      if (i === next) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
    });
    texts.forEach((t, i) => (t.hidden = i !== next));
    fitLogos();
    [...links, ...dots].forEach((b) => {
      if (+b.dataset.featGo! === next) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    syncLoops();
    const kids = Array.from(texts[next].children);
    if (reduced) {
      if (desk) { gsap.set(slides[next], { opacity: 1 }); gsap.set(slides[prev], { opacity: 0 }); }
      return;
    }
    if (!desk) {
      gsap.fromTo(kids, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', stagger: 0.06, clearProps: 'transform', overwrite: 'auto' });
      return;
    }
    sound.tab(0.85);
    const y = dir === 'down' ? 22 : -22;
    gsap.fromTo(stage, { y, filter: 'blur(10px)' }, { y: 0, filter: 'blur(0px)', duration: 0.8, ease: 'power3.out', clearProps: 'filter,transform', overwrite: 'auto' });
    gsap.fromTo(kids, { opacity: 0, y, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.65, ease: 'power3.out', stagger: 0.07, clearProps: 'filter,transform', overwrite: 'auto' });
    gsap.fromTo(slides[next], { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out', overwrite: 'auto' });
    gsap.to(slides[prev], { opacity: 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });
  };

  /* ---- desktop: the pinned scroll drives the index ------------------------ */
  let st: ScrollTrigger | null = null;
  const buildDesk = () => {
    st?.kill();
    slides.forEach((s, i) => gsap.set(s, { opacity: i === index ? 1 : 0, y: 0 }));
    st = ScrollTrigger.create({
      trigger: root, start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => {
        const t = self.progress * n;
        const i = Math.min(n - 1, Math.floor(t));
        frac = Math.min(1, Math.max(0, t - i));
        if (i !== index) show(i);
        placeProgress();
      },
    });
    document.fonts?.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => ScrollTrigger.refresh())));
  };

  /* ---- below 1024: snap carousel ------------------------------------------ */
  let railIo: IntersectionObserver | null = null;
  const buildRail = () => {
    slides.forEach((s) => gsap.set(s, { clearProps: 'opacity,transform' }));
    railIo?.disconnect();
    railIo = new IntersectionObserver((es) => {
      let best: { i: number; r: number } | null = null;
      for (const e of es) {
        if (!e.isIntersecting) continue;
        const i = slides.indexOf(e.target as HTMLElement);
        if (i >= 0 && (!best || e.intersectionRatio > best.r)) best = { i, r: e.intersectionRatio };
      }
      if (!best) return;
      if (pendingJump !== null) { if (best.i !== pendingJump) return; pendingJump = null; }
      show(best.i);
    }, { root: stage, threshold: [0.6, 0.9] });
    slides.forEach((s) => railIo!.observe(s));
  };
  const railTo = (i: number) => {
    const s = slides[i];
    const left = s.offsetLeft - (stage.clientWidth - s.clientWidth) / 2;
    pendingJump = i;
    setTimeout(() => { if (pendingJump === i) pendingJump = null; }, 900);
    if (reduced || Math.abs(i - index) <= 1) {
      show(i);
      stage.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' });
      return;
    }
    gsap.to(stage, {
      opacity: 0, duration: 0.2, ease: 'power2.in', overwrite: 'auto',
      onComplete: () => { stage.scrollTo({ left, behavior: 'auto' }); show(i); gsap.to(stage, { opacity: 1, duration: 0.4, ease: 'power2.out', clearProps: 'opacity' }); },
    });
  };

  const go = (i: number) => {
    if (!desk) { railTo((i + n) % n); return; }
    dir = i > index ? 'down' : 'up';
    const top = root.getBoundingClientRect().top + scrollY;
    scrollToY(top + ((i + 0.5) / n) * (root.offsetHeight - innerHeight), { duration: 1.2, immediate: reduced });
  };
  [...links, ...dots].forEach((b) => b.addEventListener('click', () => go(+b.dataset.featGo!)));
  root.querySelector('[data-feat-prev]')?.addEventListener('click', () => go(index - 1));
  root.querySelector('[data-feat-next]')?.addEventListener('click', () => go(index + 1));

  // Swipe on the copy (phones) flips slides too.
  let touch: { x: number; y: number; t: number } | null = null;
  copy.addEventListener('touchstart', (e) => { const t = e.touches[0]; touch = t ? { x: t.clientX, y: t.clientY, t: performance.now() } : null; }, { passive: true });
  copy.addEventListener('touchend', (e) => {
    const s = touch; touch = null;
    const t = e.changedTouches[0];
    if (!s || !t || desk) return;
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) < 36 || Math.abs(dx) < 1.4 * Math.abs(dy) || performance.now() - s.t > 700) return;
    go(dx < 0 ? index + 1 : index - 1);
  }, { passive: true });

  // Wordmark logos never overflow their column: shrink the long ones to fit.
  const fitLogos = () => texts.forEach((t) => {
    const box = t.querySelector<HTMLElement>('.feat__logo');
    const wm = box?.querySelector<HTMLElement>('.wm');
    if (!box || !wm || t.hidden) return;
    wm.style.fontSize = '';
    const room = (box.parentElement?.clientWidth ?? 0) * (desk ? 1 : 0.6);
    if (room && wm.scrollWidth > room) wm.style.fontSize = `${(parseFloat(getComputedStyle(wm).fontSize) * room) / wm.scrollWidth}px`;
  });

  const mode = () => {
    desk = matchMedia(DESK).matches;
    if (desk) { railIo?.disconnect(); buildDesk(); }
    else { st?.kill(); st = null; buildRail(); }
  };
  matchMedia(DESK).addEventListener('change', mode);
  addEventListener('resize', () => { placeProgress(); fitLogos(); });
  document.fonts?.ready.then(fitLogos);
  mode();
  syncLoops();
  placeProgress();
}
