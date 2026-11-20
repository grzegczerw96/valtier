/** DotReveal — the signature heading entrance.
 *
 *  Desktop, large type (>= 64px): the glyphs are rasterised to an offscreen
 *  canvas and sampled on a grid (pitch = fontSize / 44). Dots fade in along a
 *  slanted diagonal (0 -> .68 of progress), then a slanted clip wipe uncovers the
 *  real text while dots behind the wipe line disappear (.74 -> .98).
 *  Small type / phones: only the slanted wipe (phones also show a faint ghost
 *  of the text as it scrolls in).
 *
 *  Markup is produced by DotReveal.astro. Options are data-attributes:
 *    data-delay, data-wait-veil, data-event, data-start, data-phone-start, data-per-line
 */
import { gsap, ScrollTrigger } from './gsap';
import { isPhone, prefersReducedMotion, clamp01, mixInt } from './env';
import { afterVeil } from './veil';
import { isPast, revealOnce } from './inview';

export const DOT_PITCH_BASE = 4;
export const GHOST_OPACITY = 0.3;

const powerInOut = gsap.parseEase('power1.inOut');

type Dot = { x: number; y: number; t: number; r: number; g: number; b: number };
type Band = { top: number; bottom: number };

export function initDotReveal(root: HTMLElement) {
  if ((root as any)._dr) return (root as any)._dr as () => void;
  const content = root.querySelector<HTMLElement>(':scope > .dr-content');
  const canvas = root.querySelector<HTMLCanvasElement>(':scope > .dr-canvas');
  const ghost = root.querySelector<HTMLElement>(':scope > .dr-ghost');
  if (!content || !canvas) return () => {};

  const d = root.dataset;
  const delay = parseFloat(d.delay || '0');
  const waitVeil = d.waitVeil !== undefined;
  const event = d.event || '';
  const startAt = parseFloat(d.start || '0.85');
  const phoneStartAt = d.phoneStart ? parseFloat(d.phoneStart) : undefined;
  const perLine = d.perLine !== undefined;

  if (prefersReducedMotion()) {
    content.style.clipPath = 'none';
    canvas.style.display = 'none';
    if (ghost) ghost.style.display = 'none';
    return () => {};
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    content.style.clipPath = 'none';
    return () => {};
  }

  const phone = isPhone();
  const trigRatio = phone && phoneStartAt !== undefined ? phoneStartAt : startAt;
  let dots: Dot[] = [];
  let W = 0, H = 0, pad = 0, dpr = 1, big = false, pitch = DOT_PITCH_BASE;
  let bands: Band[] = [];
  const state = { p: 0 };
  let ghostRamp = waitVeil ? 1 : 0;
  let disposed = false;

  const measureBands = () => {
    bands = [];
    if (!perLine) return;
    const box = content.getBoundingClientRect();
    const rects: Band[] = [];
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let n: Node | null;
    while ((n = walker.nextNode())) {
      if (!(n.textContent || '').trim()) continue;
      range.selectNodeContents(n);
      for (const r of Array.from(range.getClientRects())) {
        if (r.height <= 1 || r.width <= 0) continue;
        rects.push({ top: r.top - box.top, bottom: r.bottom - box.top });
      }
    }
    rects.sort((a, b) => a.top - b.top);
    const merged: Band[] = [];
    for (const r of rects) {
      const last = merged[merged.length - 1];
      const mid = (r.top + r.bottom) / 2;
      if (last && mid > last.top && mid < last.bottom) {
        last.top = Math.min(last.top, r.top);
        last.bottom = Math.max(last.bottom, r.bottom);
      } else merged.push({ ...r });
    }
    if (merged.length < 2) return;
    const h = box.height;
    bands = merged.map((b, i) => ({
      top: i === 0 ? -0.15 * h : (merged[i - 1].bottom + b.top) / 2,
      bottom: i === merged.length - 1 ? 1.15 * h : (b.bottom + merged[i + 1].top) / 2,
    }));
  };

  const totalDur = () => (big ? 1.25 : 0.9) + (bands.length > 1 ? (bands.length - 1) * 0.16 : 0);
  const lineEase = (p: number, i: number) => {
    const base = big ? 1.25 : 0.9;
    const tot = totalDur();
    return powerInOut(clamp01((p - (0.16 * i) / tot) / (base / tot)));
  };

  const build = () => {
    measureBands();
    if (phone) {
      dots = [];
      big = false;
      canvas.style.display = 'none';
      return;
    }
    const box = content.getBoundingClientRect();
    W = Math.max(10, Math.round(box.width));
    const h = Math.max(10, Math.round(box.height));
    const cs = getComputedStyle(content);
    const fs = parseFloat(cs.fontSize) || h;
    big = fs >= 64;
    pitch = Math.max(2.4, fs / 44);
    if (!big) {
      dots = [];
      canvas.style.display = 'none';
      return;
    }
    pad = Math.round(0.18 * h);
    H = h + 2 * pad;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.style.top = `-${pad}px`;
    canvas.style.display = '';

    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const o = off.getContext('2d', { willReadFrequently: true });
    if (!o) return;
    // baseline probe: a zero-size inline-block sits on the text baseline
    const probe = document.createElement('span');
    probe.style.cssText = 'display:inline-block;width:0;height:0;overflow:hidden';
    content.appendChild(probe);
    const pr = probe.getBoundingClientRect();
    const baseY = pr.bottom - box.top + pad;
    const all = document.createRange();
    all.selectNodeContents(content);
    const lastLine = Array.from(all.getClientRects()).filter((r) => r.height > 1).pop();
    const descent = lastLine ? lastLine.bottom - pr.bottom : 0;
    content.removeChild(probe);

    o.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    o.textBaseline = 'alphabetic';
    o.textAlign = 'left';
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let any = false;
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const text = n.textContent || '';
      if (!text.trim()) continue;
      const pcs = getComputedStyle(n.parentElement ?? content);
      o.fillStyle = pcs.color || '#fff';
      const ls = parseFloat(pcs.letterSpacing) || 0;
      const tt = pcs.textTransform;
      for (let i = 0; i < text.length; i++) {
        let ch = text[i];
        ch = tt === 'uppercase' ? ch.toUpperCase() : tt === 'lowercase' ? ch.toLowerCase() : ch;
        if (!ch.trim()) continue;
        range.setStart(n, i);
        range.setEnd(n, i + 1);
        const r = range.getBoundingClientRect();
        const x = r.left - box.left;
        const w = r.width - ls;
        if (w <= 0) continue;
        const m = o.measureText(ch);
        if (m.width <= 0) continue;
        const y = descent > 0 ? r.bottom - box.top + pad - descent : baseY;
        o.save();
        o.translate(x, y);
        o.scale(w / m.width, 1);
        o.fillText(ch, 0, 0);
        o.restore();
        any = true;
      }
    }
    if (!any) {
      dots = [];
      big = false;
      canvas.style.display = 'none';
      return;
    }
    const px = o.getImageData(0, 0, W, H).data;
    dots = [];
    for (let y = pitch / 2; y < H; y += pitch) {
      for (let x = pitch / 2; x < W; x += pitch) {
        const k = (Math.round(y) * W + Math.round(x)) * 4;
        if (px[k + 3] > 128) {
          dots.push({ x, y, t: ((x + 0.18 * W * (y / H)) / (1.18 * W)) * 0.8 + 0.1 * Math.random(), r: px[k], g: px[k + 1], b: px[k + 2] });
        }
      }
    }
  };

  const drawDots = (p: number) => {
    if (!big) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const appear = Math.min(p / 0.68, 1);
    const wipe = clamp01((p - 0.74) / 0.24);
    const line = -12 + wipe * (1.18 * W + 12);
    const multi = bands.length > 1;
    for (const dt of dots) {
      const a = clamp01((appear - dt.t) / 0.1);
      let edge: number;
      if (multi) {
        const yy = dt.y - pad;
        let li = bands.findIndex((b) => yy < b.bottom);
        if (li < 0) li = bands.length - 1;
        const b = bands[li];
        edge = -12 + lineEase(wipe, li) * (1.18 * W + 12) - 0.18 * W * ((yy - b.top) / (b.bottom - b.top));
      } else edge = line - 0.18 * W * (dt.y / H);
      const alpha = a * clamp01((dt.x - edge) / 10);
      if (alpha <= 0.02) continue;
      const u = Math.min(1, 0.3 + 0.7 * a);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${mixInt(46, dt.r, u)}, ${mixInt(43, dt.g, u)}, ${mixInt(51, dt.b, u)})`;
      ctx.beginPath();
      ctx.arc(dt.x, dt.y, pitch * (0.086 + 0.093 * a), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const clip = (p: number) => {
    const t = clamp01(big ? (p - 0.74) / 0.24 : p);
    if (t >= 1) {
      content.style.clipPath = 'none';
      return;
    }
    if (bands.length > 1) {
      const pts = [`-25% ${bands[0].top.toFixed(1)}px`];
      bands.forEach((b, i) => {
        const x = 118 * lineEase(t, i);
        pts.push(`${x.toFixed(2)}% ${b.top.toFixed(1)}px`, `${(x - 18).toFixed(2)}% ${b.bottom.toFixed(1)}px`);
      });
      pts.push(`-25% ${bands[bands.length - 1].bottom.toFixed(1)}px`);
      content.style.clipPath = `polygon(${pts.join(', ')})`;
      return;
    }
    const x = 118 * t;
    content.style.clipPath = `polygon(0 -15%, ${x}% -15%, ${x - 18}% 115%, 0 115%)`;
  };

  const ghostFx = () => {
    if (!phone || !ghost) return;
    if (state.p >= 1) {
      ghost.style.opacity = '0';
      return;
    }
    ghost.style.opacity = String(Math.max(ghostRamp, clamp01(4 * state.p)) * GHOST_OPACITY);
  };

  const render = () => {
    drawDots(state.p);
    clip(state.p);
    ghostFx();
  };

  let tween: gsap.core.Tween | null = null;
  const play = () => {
    if (tween) return;
    tween = gsap.to(state, { p: 1, delay, duration: totalDur(), ease: bands.length > 1 ? 'none' : 'power1.inOut', onUpdate: render });
  };

  build();
  render();

  const rebuild = () => {
    if (disposed) return;
    build();
    render();
  };
  let lastFs = getComputedStyle(content).fontSize;
  const ro = perLine
    ? new ResizeObserver(() => {
        const fs = getComputedStyle(content).fontSize;
        if (fs !== lastFs) {
          lastFs = fs;
          build();
        } else measureBands();
        render();
      })
    : null;
  ro?.observe(content);
  document.fonts?.ready.then(rebuild);
  window.addEventListener('resize', rebuild);
  document.fonts?.addEventListener('loadingdone', rebuild);

  const cleanups: Array<() => void> = [];
  if (phone && ghost && !waitVeil) {
    const st = ScrollTrigger.create({
      trigger: root,
      start: 'top bottom',
      end: 'top 78%',
      onUpdate: (s) => {
        ghostRamp = s.progress;
        ghostFx();
      },
    });
    cleanups.push(() => st.kill());
  }

  if (event) {
    const onEvt = (e: Event) => {
      const revealed = (e as CustomEvent).detail?.revealed ?? true;
      if (revealed) play();
      else {
        tween?.kill();
        tween = null;
        state.p = 0;
        render();
      }
    };
    window.addEventListener(event, onEvt);
    cleanups.push(() => window.removeEventListener(event, onEvt));
    // The event may have fired before this headline initialised (lazy init, page
    // restored at the bottom): replay the last state.
    if (lastEvent(event)) play();
  } else if (waitVeil) {
    cleanups.push(afterVeil(play));
  } else {
    cleanups.push(
      revealOnce(root, trigRatio, play, () => {
        const top = root.getBoundingClientRect().top + window.scrollY;
        return Math.min(top - window.innerHeight * trigRatio, Math.max(0, ScrollTrigger.maxScroll(window) - 48));
      }),
    );
    if (isPast(root, trigRatio)) play();
  }

  const dispose = () => {
    disposed = true;
    cleanups.forEach((f) => f());
    tween?.kill();
    ro?.disconnect();
    window.removeEventListener('resize', rebuild);
    document.fonts?.removeEventListener('loadingdone', rebuild);
    content.style.clipPath = 'none';
  };
  (root as any)._dr = dispose;
  return dispose;
}

/** Broadcasts a reveal event and remembers it, so late subscribers can catch up. */
export function emitReveal(name: string, revealed: boolean) {
  ((window as any).__vReveal ??= {})[name] = revealed;
  window.dispatchEvent(new CustomEvent(name, { detail: { revealed } }));
}
const lastEvent = (name: string) => !!(window as any).__vReveal?.[name];

export function initAllDotReveals(scope: ParentNode = document) {
  scope.querySelectorAll<HTMLElement>('[data-dot-reveal]').forEach(initDotReveal);
}

/** Shows a DotReveal heading in its final state at once (no dots, no wipe). */
export function revealNow(root: HTMLElement) {
  const content = root.querySelector<HTMLElement>(':scope > .dr-content');
  const canvas = root.querySelector<HTMLElement>(':scope > .dr-canvas');
  const ghost = root.querySelector<HTMLElement>(':scope > .dr-ghost');
  if (content) content.style.clipPath = 'none';
  if (canvas) canvas.style.display = 'none';
  if (ghost) ghost.style.display = 'none';
  (root as any)._dr = () => {};
}
