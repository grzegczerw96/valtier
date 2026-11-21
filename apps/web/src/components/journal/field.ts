/** Desktop field: every entry is laid out (n x m copies) on a sheared lattice and
 *  the layer is translated by a camera. Drag / wheel move the camera target; the
 *  camera eases toward it (0.14 per 60 Hz frame, 0.085 while an entry is open),
 *  throws keep gliding (velocity x0.92 per frame), and when the motion settles
 *  the camera snaps onto the nearest entry. The camera wraps inside one lattice
 *  cell, so the field never ends. While moving, the field eases out to 0.85. */
import { createItem, type ItemView } from './item';
import { expanded, fieldScale, heroBox, heroScale, nearest, scaleItem, type Field, type Item, type Lattice } from './layout';
import { CONTENT_MAX, prefersReducedMotion } from '@valtier/ds/motion/env';

export interface FieldApi {
  setActive(id: string | null): void;
  /** Arriving with ?item=: keep the camera on the entry and the others hidden until `release()`. */
  entrance(id: string): void;
  release(): void;
  heroScaleFor(id: string): number;
}

interface Copy { view: ItemView; item: Item; x: number; y: number; base: boolean }

const HOLD_MS = 950;
const HOLD_AFTER_MS = 750;

export function createField(root: HTMLElement, layer: HTMLElement, captions: HTMLElement, source: Item[], field: Field, onOpen: (it: Item) => void): FieldApi {
  const reduced = prefersReducedMotion();
  let W = root.clientWidth || window.innerWidth;
  let H = root.clientHeight || window.innerHeight;
  let S = fieldScale(W, H);
  let scaled: Item[] = [];
  let L: Lattice = { w: 1, h: 1, sx: 0, sy: 0 };
  let copies: Copy[] = [];
  let activeId: string | null = null;
  let hero = 1;
  const byId = new Map(source.map((it) => [it.id, it]));

  const cam = { x: 0, y: 0 };       // eased camera
  const target = { x: 0, y: 0 };    // where the camera is heading
  const vel = { x: 0, y: 0 };       // throw velocity (px/s)
  let zoom = 1;
  let lastWheel = -1e9;
  let moving = false;
  let lastClose = -1e9;
  let holdUntil = 0;

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const c = copyOf.get(e.target as HTMLElement);
        c?.view.setDepth(e.isIntersecting && (!activeId || c.item.id === activeId));
      }
    },
    { rootMargin: '75%' },
  );
  const copyOf = new Map<HTMLElement, Copy>();

  function scaledItem(id: string) { return scaled.find((s) => s.id === id); }

  function build() {
    for (const c of copies) { io.unobserve(c.view.el); c.view.destroy(); }
    copies = [];
    copyOf.clear();
    S = fieldScale(W, H);
    scaled = source.map((it) => (S === 1 ? it : scaleItem(it, S, true)));
    L = { w: field.tileW * S, h: field.tileH * S, sx: field.shearX * S, sy: field.shearY * S };
    const pad = 700 * S;
    const nc = Math.max(1, Math.ceil((W / 2 + 0.3 * L.w + pad) / L.w));
    const nr = Math.max(1, Math.ceil((H / 2 + 0.2 * L.h + pad) / L.h));
    const frag = document.createDocumentFragment();
    for (const it of scaled) {
      for (let c = -nc; c <= nc; c++) {
        for (let r = -nr; r <= nr; r++) {
          const base = c === 0 && r === 0;
          const view = createItem(it, { lightweight: false, tabIndex: base ? 0 : -1 });
          const x = it.x + c * L.w + r * L.sx;
          const y = it.y + r * L.h + c * L.sy;
          view.el.style.left = `${x - it.width / 2}px`;
          view.el.style.top = `${y - it.height / 2}px`;
          if (!base) view.el.setAttribute('aria-hidden', 'true');
          const copy: Copy = { view, item: it, x, y, base };
          copies.push(copy);
          copyOf.set(view.el, copy);
          frag.append(view.el);
          if (it.depth) io.observe(view.el);
        }
      }
    }
    layer.append(frag);
    applyStates();
  }

  function applyStates() {
    for (const c of copies) c.view.setState(activeId ? (c.item.id === activeId ? 'active' : 'dimmed') : 'idle', hero);
  }

  // ---------------------------------------------------------------- captions
  interface Cap { label: HTMLDivElement; chars: HTMLElement[]; on: boolean; p: number; shown: number; ax: number; ay: number; seen: boolean }
  const caps = new Map<string, Cap>();
  for (const it of source) {
    if (caps.has(it.id) || !it.label) continue;
    const label = document.createElement('div');
    label.className = 'label-sm jr-caption';
    const chars: HTMLElement[] = [];
    const words = it.label.split(' ');
    words.forEach((w, i) => {
      const span = document.createElement('span');
      for (const ch of w) {
        const c = document.createElement('i');
        c.textContent = ch;
        span.append(c);
        chars.push(c);
      }
      label.append(span);
      if (i < words.length - 1) label.append(document.createTextNode(' '));
    });
    captions.append(label);
    caps.set(it.id, { label, chars, on: false, p: 0, shown: 0, ax: 0, ay: 0, seen: false });
  }
  const showChars = (c: Cap, n: number) => {
    n = Math.max(0, Math.min(c.chars.length, n));
    if (n > c.shown) for (let i = c.shown; i < n; i++) c.chars[i].classList.add('on');
    else if (n < c.shown) for (let i = n; i < c.shown; i++) c.chars[i].classList.remove('on');
    c.shown = n;
  };
  const resetCaptions = () => caps.forEach((c) => { showChars(c, 0); c.label.style.opacity = '0'; c.on = false; c.p = 0; c.seen = false; });

  function updateCaptions(dt: number) {
    const cx = W / 2, cy = H / 2;
    const radius = (0.8 * Math.min(W, H)) / 2;
    const gap = 14 * Math.max(1, Math.min(Math.min(W, CONTENT_MAX) / 1440, H / 900, 1.8));
    for (const it of scaled) {
      const c = caps.get(it.id);
      if (!c) continue;
      const p = nearest(it.x, it.y, cam.x, cam.y, L);
      const sx = cx + zoom * (p.x - cam.x), sy = cy + zoom * (p.y - cam.y);
      const a = (it.rotation * Math.PI) / 180, co = Math.abs(Math.cos(a)), si = Math.abs(Math.sin(a));
      // From the entry's box (its lift is inside the box, so the caption stays put).
      const hy = ((it.height * co + it.width * si) / 2) * zoom;
      const onScreen = sx > -200 && sx < W + 200 && sy > -200 && sy < H + 200;
      if (onScreen) {
        c.ax = sx;
        c.ay = sy + hy + gap;
        c.seen = true;
        const d = Math.hypot(sx - cx, sy - cy);
        if (!c.on && d < radius) c.on = true;
        else if (c.on && d > 1.08 * radius) c.on = false;
      } else c.on = false;
      c.p = reduced ? (c.on ? c.chars.length : 0) : c.on ? Math.min(c.chars.length, c.p + 34 * dt) : Math.max(0, c.p - 34 * dt);
      if (!(c.seen && (c.on || c.p > 0))) {
        c.label.style.opacity = '0';
        if (c.shown) showChars(c, 0);
        continue;
      }
      c.label.style.transform = `translate(${c.ax.toFixed(1)}px, ${c.ay.toFixed(1)}px) translateX(-50%)`;
      c.label.style.opacity = '0.72';
      showChars(c, Math.round(c.p));
    }
  }

  // ---------------------------------------------------------------- snap
  function snapToNearest() {
    let best = Infinity, bx = 0, by = 0;
    for (const it of scaled) {
      const p = nearest(it.x, it.y, cam.x, cam.y, L);
      const d = (p.x - cam.x) ** 2 + (p.y - cam.y) ** 2;
      if (d < best) { best = d; bx = p.x; by = p.y; }
    }
    if (best !== Infinity) { vel.x = vel.y = 0; target.x = bx; target.y = by; }
  }

  // ---------------------------------------------------------------- frame loop
  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (root.hidden || document.hidden) return;
    const f60 = dt * 60;
    if (!drag) {
      target.x += vel.x * dt;
      target.y += vel.y * dt;
      const k = Math.pow(0.92, f60);
      vel.x *= k; vel.y *= k;
      if (Math.abs(vel.x) < 0.5) vel.x = 0;
      if (Math.abs(vel.y) < 0.5) vel.y = 0;
    }
    if (now >= holdUntil) {
      const ease = 1 - Math.pow(1 - (activeId ? 0.085 : 0.14), f60);
      cam.x += (target.x - cam.x) * ease;
      cam.y += (target.y - cam.y) * ease;
    }
    // keep the camera inside one lattice cell
    const w = nearest(0, 0, cam.x, cam.y, L);
    if (w.x || w.y) {
      cam.x -= w.x; cam.y -= w.y; target.x -= w.x; target.y -= w.y;
      if (drag) { drag.camX -= w.x; drag.camY -= w.y; }
    }
    const speed = Math.hypot(vel.x, vel.y);
    const isMoving = !activeId && (!!drag || speed > 40 || now - lastWheel < 160);
    if (isMoving) moving = true;
    else if (moving && !activeId) { moving = false; snapToNearest(); }
    const z = isMoving && !reduced ? 0.85 : 1;
    zoom += (z - zoom) * (1 - Math.pow(1 - 0.09, f60));
    if (Math.abs(zoom - 1) < 0.0015) zoom = 1;
    const ex = W / 2 - cam.x, ey = H / 2 - cam.y;
    layer.style.transform = zoom === 1
      ? `translate3d(${ex}px, ${ey}px, 0)`
      : `translate(${W / 2}px, ${H / 2}px) scale(${zoom}) translate(${-W / 2}px, ${-H / 2}px) translate3d(${ex}px, ${ey}px, 0)`;
    if (!activeId) updateCaptions(dt);
  };

  // ---------------------------------------------------------------- input
  let drag: { id: number; sx: number; sy: number; camX: number; camY: number; t: number; lx: number; ly: number; dist: number } | null = null;
  let lastOpen = 0;
  let tick: ((k: number) => void) | null = null;
  import('@valtier/ds/motion/sound').then(({ sound }) => (tick = sound.tick));

  const open = (id: string | undefined) => {
    if (!id || activeId || performance.now() - lastOpen < 350) return;
    const it = byId.get(id);
    if (!it) return;
    lastOpen = performance.now();
    vel.x = vel.y = 0;
    onOpen(it);
  };

  root.addEventListener('pointerdown', (e) => {
    if (activeId || (e.pointerType === 'mouse' && e.button !== 0)) return;
    try { root.setPointerCapture(e.pointerId); } catch {}
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, camX: target.x, camY: target.y, t: performance.now(), lx: e.clientX, ly: e.clientY, dist: 0 };
    vel.x = vel.y = 0;
  });
  root.addEventListener('pointermove', (e) => {
    const d = drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    target.x = d.camX - dx;
    target.y = d.camY - dy;
    d.dist = Math.max(d.dist, Math.hypot(dx, dy));
    const now = performance.now();
    const t = (now - d.t) / 1000;
    if (t > 0) {
      const mx = e.clientX - d.lx;
      vel.x = -mx / t;
      vel.y = -(e.clientY - d.ly) / t;
      if (Math.abs(mx) > 6) tick?.(Math.min(1, Math.abs(mx) / 28));
    }
    d.t = now; d.lx = e.clientX; d.ly = e.clientY;
  });
  const up = (e: PointerEvent) => {
    const d = drag;
    if (!d || d.id !== e.pointerId) return;
    try { root.releasePointerCapture(e.pointerId); } catch {}
    drag = null;
    if (e.type === 'pointerup' && d.dist < 6 && !activeId) {
      const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-journal-item]');
      open(hit?.dataset.journalItem);
    }
  };
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  // Keyboard activation only (pointer taps are handled on pointerup).
  root.addEventListener('click', (e) => {
    if (e.detail !== 0) return;
    const hit = (e.target as Element).closest<HTMLElement>('[data-journal-item]');
    open(hit?.dataset.journalItem);
  });
  root.addEventListener('wheel', (e) => {
    if (activeId || e.ctrlKey) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1;
    const shift = e.shiftKey && !e.deltaX;
    target.x += (shift ? e.deltaY : e.deltaX) * unit;
    target.y += (shift ? 0 : e.deltaY) * unit;
    vel.x = vel.y = 0;
    lastWheel = performance.now();
  }, { passive: false });
  root.addEventListener('scroll', () => { root.scrollLeft = 0; root.scrollTop = 0; });
  root.addEventListener('focusin', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-journal-item]');
    if (!el || activeId || !el.matches(':focus-visible') || performance.now() - lastClose < 1000) return;
    const r = el.getBoundingClientRect();
    vel.x = vel.y = 0;
    target.x = cam.x + (r.left + r.width / 2 - W / 2) / zoom;
    target.y = cam.y + (r.top + r.height / 2 - H / 2) / zoom;
  });

  // ---------------------------------------------------------------- resize
  const resize = () => {
    const nw = root.clientWidth, nh = root.clientHeight;
    if (!nw || !nh || (nw === W && nh === H)) return;
    const k = fieldScale(nw, nh) / S;
    W = nw; H = nh;
    if (k !== 1) {
      cam.x *= k; cam.y *= k; target.x *= k; target.y *= k;
      build();
    }
    if (activeId) aim(activeId);
  };
  new ResizeObserver(resize).observe(root);

  // ---------------------------------------------------------------- active entry
  function aim(id: string) {
    const it = scaledItem(id);
    if (!it) return;
    const wide = expanded(it);
    const box = heroBox(W, H, wide);
    hero = heroScale(it, W, H, wide);
    applyStates();
    const p = nearest(it.x + W / 2 - box.cx, it.y + H / 2 - box.cy, target.x, target.y, L);
    target.x = p.x; target.y = p.y;
  }

  function setActive(id: string | null) {
    const prevId = activeId;
    activeId = id;
    vel.x = vel.y = 0;
    if (id) {
      for (const c of copies) if (c.item.depth && c.item.id !== id) c.view.setDepth(false);
      aim(id);
      return;
    }
    lastClose = performance.now();
    resetCaptions();
    applyStates();
    // centre the entry that was open, then let the depth layers come back
    const it = prevId ? scaledItem(prevId) : null;
    if (it) {
      const p = nearest(it.x, it.y, target.x, target.y, L);
      target.x = p.x; target.y = p.y;
    }
    io.disconnect();
    for (const c of copies) if (c.item.depth) io.observe(c.view.el);
  }

  // ---------------------------------------------------------------- entrance
  let hidden: Animation[] = [];
  let entranceDone = false;
  function entrance(id: string) {
    const it = scaledItem(id);
    if (!it) return;
    cam.x = target.x = it.x;
    cam.y = target.y = it.y;
    holdUntil = performance.now() + HOLD_MS;
    if (reduced) { entranceDone = true; return; }
    hidden = copies.filter((c) => c.item.id !== id).map((c) => c.view.el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 60000, fill: 'both' }));
    setTimeout(release, 2400);
  }
  function release() {
    if (entranceDone) return;
    entranceDone = true;
    holdUntil = Math.max(holdUntil, performance.now() + HOLD_AFTER_MS);
    const order = new Map(source.map((it, i) => [it.id, i]));
    for (const c of copies) {
      if (c.item.id === activeId) continue;
      const el = c.view.el;
      const f = el.style.filter;
      const from = f ? f.replace(/^blur\([^)]*\)/, 'blur(14px)') : 'blur(14px)';
      el.animate([{ opacity: 0, filter: from }, { opacity: el.style.opacity || '1', filter: f || 'none' }], {
        duration: 620, delay: 120 + 55 * (order.get(c.item.id) ?? 0), easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards',
      });
    }
    hidden.forEach((a) => a.cancel());
    hidden = [];
  }

  build();
  requestAnimationFrame(frame);
  return { setActive, entrance, release, heroScaleFor: (id) => { const it = scaledItem(id); return it ? heroScale(it, W, H, expanded(it)) : 1; } };
}
