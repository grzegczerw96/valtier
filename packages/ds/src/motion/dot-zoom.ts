/** DotZoom — a display headline that arrives as an LED matrix.
 *
 *  The lines are rasterised (200px tall) and sampled on a grid; the resulting dots
 *  are drawn on a full-viewport canvas at the lines' *animated* rects, so the text
 *  can start enormous (×14) and shrink into place while the dots light up from
 *  the right. From `wipeStart` each line's real text is uncovered by a slanted
 *  wipe and the dots behind the wipe go out. Driven by a scroll progress 0..1.
 *
 *    const dz = createDotZoom({ canvas, wrap, title, desc, marks });
 *    dz.measure(); dz.render(progress);
 */

export const DOT_ZOOM = {
  startFactor: 14,
  easePower: 2,
  posY: -5.3,        // final offset, in min(1vh, .625vu) units
  dotSize: 0.2,
  dotEnd: 0.74,
  wipeStart: 0.74,
  jitter: 0.1,
  fontVu: 9.5,       // headline size in --vu
  descVu: 1.05,
} as const;

const easeOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) * (1 - t));
const vuOf = (w: number, h: number) => Math.min(Math.min(w, 1728) / 100, (1.8 * h) / 100);

interface Dot { line: number; nx: number; ny: number; base: number; rnd: number }
type Rect = { left: number; top: number; width: number; height: number };

export interface DotZoomOptions {
  canvas: HTMLCanvasElement;
  /** Centred wrapper that is translated as a whole. */
  wrap: HTMLElement;
  /** Headline holding one [data-dz-line] element per line. */
  title: HTMLElement;
  /** Paragraph under the headline (scaled with the headline, fades in at the end). */
  desc?: HTMLElement | null;
  /** Decoration above the headline (e.g. quote marks), pushed up as it grows. */
  marks?: HTMLElement | null;
  reduced?: boolean;
  pitch?: number;
}

export function createDotZoom(o: DotZoomOptions) {
  const { canvas, wrap, title, desc, marks } = o;
  const ctx = canvas.getContext('2d');
  const lines = Array.from(title.querySelectorAll<HTMLElement>('[data-dz-line]'));
  let dots: Dot[] = [];
  let color = 'rgb(180,168,150)';
  let dpr = 1, cw = 0, ch = 0, dirty = false;
  let W = window.innerWidth, H = window.innerHeight;
  let tw = 0, th = 0, fx = 0, fy = 0, descBase = 13;
  let base: Rect[] = [];
  const cur: Rect[] = [];
  const pitch = o.pitch ?? 3.8;
  const unitY = () => Math.min(H / 100, 0.625 * vuOf(W, H));

  const resizeCanvas = () => {
    const d = Math.min(2, window.devicePixelRatio || 1);
    if (d === dpr && W === cw && H === ch) return;
    dpr = d; cw = W; ch = H;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    dirty = false;
  };

  const resample = () => {
    if (!ctx) return;
    const pts: Dot[] = [];
    const off = document.createElement('canvas');
    const c = off.getContext('2d', { willReadFrequently: true });
    if (!c) return;
    const rects = lines.map((l) => l.getBoundingClientRect());
    const ok = rects.filter((r) => r.width > 2 && r.height > 2);
    if (!ok.length) return;
    const minL = Math.min(...ok.map((r) => r.left));
    const span = Math.max(1, Math.max(...ok.map((r) => r.right)) - minL);
    lines.forEach((el, li) => {
      const r = rects[li];
      if (r.width < 2 || r.height < 2) return;
      const lx = (r.left - minL) / span, lw = r.width / span;
      const cs = getComputedStyle(el);
      color = cs.color || color;
      const k = 200 / r.height, w = Math.max(2, Math.round(r.width * k)), pad = 56, h = 200 + 2 * pad;
      off.width = w; off.height = h;
      const probe = document.createElement('span');
      probe.style.cssText = 'display:inline-block;width:0;height:0;overflow:hidden';
      el.appendChild(probe);
      const baseline = (probe.getBoundingClientRect().bottom - r.top) * k + pad;
      el.removeChild(probe);
      c.clearRect(0, 0, w, h);
      c.font = `${cs.fontWeight} ${(parseFloat(cs.fontSize) || r.height) * k}px ${cs.fontFamily}`;
      c.textBaseline = 'alphabetic';
      c.fillStyle = '#fff';
      const ls = parseFloat(cs.letterSpacing) || 0;
      const text = el.textContent || '';
      const node = el.firstChild;
      const up = (s: string) => (cs.textTransform === 'uppercase' ? s.toUpperCase() : s);
      let drawn = false;
      if (node && node.nodeType === Node.TEXT_NODE && node.textContent === text) {
        // Place every glyph at its laid-out position (canvas fonts can't follow font-stretch etc.).
        const range = document.createRange();
        for (let i = 0; i < text.length; i++) {
          range.setStart(node, i); range.setEnd(node, i + 1);
          const b = range.getBoundingClientRect();
          const chr = up(text[i]);
          const gw = b.width - ls;
          if (!chr.trim() || gw <= 0) continue;
          const m = c.measureText(chr);
          if (m.width <= 0) continue;
          c.save();
          c.translate((b.left - r.left) * k, baseline);
          c.scale((gw * k) / m.width, 1);
          c.fillText(chr, 0, 0);
          c.restore();
        }
        drawn = true;
      }
      if (!drawn) {
        const s = up(text.trim()), mw = c.measureText(s).width || w;
        c.save(); c.translate(0, baseline); c.scale(w / mw, 1); c.fillText(s, 0, 0); c.restore();
      }
      const data = c.getImageData(0, 0, w, h).data;
      for (let y = pitch / 2; y < h; y += pitch)
        for (let x = pitch / 2; x < w; x += pitch) {
          if ((data[(Math.round(y) * w + Math.round(x)) * 4 + 3] ?? 0) > 110) {
            const nx = x / w;
            pts.push({ line: li, nx, ny: (y - pad) / 200, base: 1 - (lx + nx * lw), rnd: (((43758.5453 * Math.sin(12.9898 * x + 78.233 * y + 37 * li)) % 1) + 1) % 1 });
          }
        }
    });
    dots = pts;
  };

  /** Re-measure the untransformed layout (call on resize / font load). */
  const measure = () => {
    W = window.innerWidth; H = window.innerHeight;
    const vu = vuOf(W, H);
    descBase = Math.max(13, DOT_ZOOM.descVu * vu);
    title.style.fontSize = `calc(${DOT_ZOOM.fontVu} * var(--vu))`;
    title.style.transform = 'none';
    title.style.visibility = '';
    if (desc) desc.style.fontSize = `max(13px, calc(${DOT_ZOOM.descVu} * var(--vu)))`;
    if (marks) marks.style.transform = 'none';
    const prev = wrap.style.transform;
    wrap.style.transform = 'translate(-50%, -50%)';
    const wr = wrap.getBoundingClientRect(), tr = title.getBoundingClientRect();
    tw = tr.width; th = tr.height;
    fx = tr.left + tw / 2 - (wr.left + wr.width / 2);
    fy = tr.top + th / 2 - (wr.top + wr.height / 2);
    base = lines.map((l) => {
      const r = l.getBoundingClientRect();
      return { left: r.left - tr.left - tw / 2, top: r.top - tr.top - th / 2, width: r.width, height: r.height };
    });
    base.forEach((b, i) => (cur[i] = { ...b }));
    resample();
    wrap.style.transform = prev;
    resizeCanvas();
  };

  const draw = (t: number) => {
    const n = Math.max(1, lines.length);
    const wipe = new Array(n).fill(0);
    if (!ctx) return wipe;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (dirty) ctx.clearRect(0, 0, cw, ch);
    dirty = false;
    const { dotSize, dotEnd, wipeStart, jitter } = DOT_ZOOM;
    const M = Math.min(1, t / dotEnd), S = Math.max(1e-4, 0.92 - wipeStart) / n;
    for (let i = 0; i < n; i++) wipe[i] = Math.max(0, Math.min(1, (t - (wipeStart + i * S)) / S));
    if (t <= 0 || wipe.every((v) => v >= 1)) return wipe;
    const paths: (Path2D | null)[] = new Array(15).fill(null);
    for (const d of dots) {
      const r = cur[d.line];
      if (!r || r.width < 1) continue;
      const a = easeOut((M - (d.base * (1 - jitter) + d.rnd * jitter) * 0.91) / 0.09);
      if (a <= 0) continue;
      const lvl = Math.round(a * (1 - Math.max(0, Math.min(1, (wipe[d.line] - d.nx) / 0.05))) * 14);
      if (lvl <= 0) continue;
      const x = r.left + d.nx * r.width, y = r.top + d.ny * r.height, rad = (r.height / 200) * pitch * dotSize * a;
      if (x + rad < 0 || x - rad > cw || y + rad < 0 || y - rad > ch) continue;
      const p = (paths[lvl] ??= new Path2D());
      p.moveTo(x + rad, y);
      p.arc(x, y, rad, 0, Math.PI * 2);
    }
    ctx.fillStyle = color;
    for (let l = 1; l <= 14; l++) {
      const p = paths[l];
      if (p) { ctx.globalAlpha = l / 14; ctx.fill(p); dirty = true; }
    }
    ctx.globalAlpha = 1;
    return wipe;
  };

  /** Pose everything for progress t (0..1). */
  const render = (t: number) => {
    const C = 1 - Math.pow(1 - t, DOT_ZOOM.easePower);
    const P = DOT_ZOOM.startFactor - (DOT_ZOOM.startFactor - 1) * C;
    const Y = DOT_ZOOM.posY * C * unitY();
    if (o.reduced) {
      wrap.style.transform = `translate(-50%, calc(-50% + ${DOT_ZOOM.posY * unitY()}px))`;
      title.style.transform = 'none';
      title.style.visibility = '';
      lines.forEach((l) => (l.style.clipPath = 'none'));
      if (desc) { desc.style.transform = 'translateX(-50%)'; desc.style.opacity = String(t > 0 ? 0.85 : 0); }
      return;
    }
    wrap.style.transform = `translate(-50%, calc(-50% + ${Y}px))`;
    const cx = W * 0.5 + fx, cy = 0.5 * H + Y + fy;
    for (let i = 0; i < base.length; i++) {
      const b = base[i], c = cur[i];
      c.left = cx + b.left * P; c.top = cy + b.top * P; c.width = b.width * P; c.height = b.height * P;
    }
    const live = t > DOT_ZOOM.wipeStart;
    const huge = live && tw * P * Math.min(2, window.devicePixelRatio || 1) > 8192;
    const fs = `calc(${DOT_ZOOM.fontVu * (huge ? P : 1)} * var(--vu))`;
    if (title.style.fontSize !== fs) title.style.fontSize = fs;
    title.style.visibility = live ? '' : 'hidden';
    title.style.transform = live && !huge ? `scale(${P})` : 'none';
    const lift = huge ? 0 : (th * (P - 1)) / 2;
    if (marks) marks.style.transform = `translateY(${-lift}px)`;
    if (desc) {
      const k = live ? Math.max(13, DOT_ZOOM.descVu * vuOf(W, H) * P) / descBase : 1;
      desc.style.transform = `translate(-50%, ${lift}px) scale(${k})`;
      desc.style.maxWidth = `${Math.min(30 * descBase, (0.86 * W) / k)}px`;
      desc.style.opacity = String(0.85 * Math.max(0, Math.min(1, (t - DOT_ZOOM.wipeStart) / (1 - DOT_ZOOM.wipeStart))));
    }
    const wipe = draw(t);
    lines.forEach((l, i) => {
      const v = wipe[i] ?? 0;
      if (v >= 1) { l.style.clipPath = 'none'; return; }
      const x = 118 * Math.max(0, v);
      l.style.clipPath = `polygon(0 -15%, ${x}% -15%, ${x - 18}% 115%, 0 115%)`;
    });
  };

  const clear = () => {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirty = false;
  };

  return { measure, render, clear, resize: resizeCanvas };
}
