/** Phone field: the same sheared lattice at a smaller scale, rendering only the
 *  copies near the viewport (re-culled every 80px of travel). Swipes move the
 *  camera 1:1 and a quick release glides with exponential decay (k = 3.5/s). */
import { createItem, type ItemView } from './item';
import { latticeScale, scaleItem, type Field, type Item } from './layout';
import { prefersReducedMotion } from '@valtier/ds/motion/env';

export interface LatticeApi { focus(id: string): void; setOpen(open: boolean): void }

export function createLattice(root: HTMLElement, layer: HTMLElement, source: Item[], field: Field, onOpen: (it: Item) => void): LatticeApi {
  const reduced = prefersReducedMotion();
  let W = root.clientWidth || window.innerWidth;
  let H = root.clientHeight || window.innerHeight;
  const cam = { x: 0, y: 0 };
  const drawn = { x: 0, y: 0 };
  const vel = { x: 0, y: 0 };
  let raf = 0;
  let open = false;
  let touched = false;
  const nodes = new Map<string, ItemView>();
  const byId = new Map(source.map((it) => [it.id, it]));

  function render() {
    const l = latticeScale(W, H);
    const a = field.tileW * l, o = field.tileH * l, i = field.shearX * l, s = field.shearY * l;
    const det = a * o - i * s;
    if (a <= 0 || o <= 0 || det <= 0) return;
    const seen = new Set<string>();
    for (const it of source) {
      const ex = it.x * l, ey = it.y * l;
      const w = Math.round(it.width * l), h = Math.round(it.height * l);
      const fx = cam.x - ex, fy = cam.y - ey;
      const m = Math.round((fx * o - fy * i) / det);
      const n = Math.round((fy * a - fx * s) / det);
      const rad = (it.rotation * Math.PI) / 180, co = Math.abs(Math.cos(rad)), si = Math.abs(Math.sin(rad));
      const hx = (w * co + h * si) / 2, hy = (h * co + w * si) / 2;
      const jx = W / 2 + 240 + hx, jy = H / 2 + 240 + hy;
      const E = Math.ceil((jx * o + jy * Math.abs(i)) / det);
      const F = Math.ceil((jy * a + jx * Math.abs(s)) / det);
      for (let p = -E; p <= E; p++) {
        for (let q = -F; q <= F; q++) {
          const x = ex + (m + p) * a + (n + q) * i - cam.x + W / 2;
          const y = ey + (n + q) * o + (m + p) * s - cam.y + H / 2;
          if (x + hx < -240 || x - hx > W + 240 || y + hy < -240 || y - hy > H + 240) continue;
          const key = `${it.id}:${m + p}:${n + q}`;
          seen.add(key);
          let v = nodes.get(key);
          if (!v) {
            v = createItem({ ...scaleItem(it, l, false), width: w, height: h }, { lightweight: true, tabIndex: -1 });
            v.el.setAttribute('aria-hidden', 'true');
            nodes.set(key, v);
            layer.append(v.el);
          }
          v.el.style.left = `${x - w / 2}px`;
          v.el.style.top = `${y - h / 2}px`;
        }
      }
    }
    for (const [k, v] of nodes) if (!seen.has(k)) { v.destroy(); nodes.delete(k); }
    drawn.x = cam.x; drawn.y = cam.y;
    layer.style.transform = 'translate3d(0, 0, 0)';
  }

  const paint = () => {
    layer.style.transform = `translate3d(${drawn.x - cam.x}px, ${drawn.y - cam.y}px, 0)`;
    if (Math.abs(cam.x - drawn.x) >= 80 || Math.abs(cam.y - drawn.y) >= 80) render();
  };

  const stop = () => { cancelAnimationFrame(raf); raf = 0; vel.x = vel.y = 0; };
  let lastT = 0;
  const glide = (now: number) => {
    raf = 0;
    if (document.hidden || open || drag || reduced) return stop();
    const dt = Math.min(0.04, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    const k = Math.exp(-3.5 * dt), g = (1 - k) / 3.5;
    cam.x += vel.x * g; cam.y += vel.y * g;
    vel.x *= k; vel.y *= k;
    paint();
    if (Math.hypot(vel.x, vel.y) > 8) raf = requestAnimationFrame(glide);
    else stop();
  };

  let drag: { id: number; x: number; y: number; camX: number; camY: number; px: number; py: number; at: number; dist: number } | null = null;
  root.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || open || (e.pointerType === 'mouse' && e.button !== 0)) return;
    stop();
    touched = true;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, camX: cam.x, camY: cam.y, px: e.clientX, py: e.clientY, at: performance.now(), dist: 0 };
    try { root.setPointerCapture(e.pointerId); } catch {}
  });
  root.addEventListener('pointermove', (e) => {
    const d = drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.dist = Math.max(d.dist, Math.hypot(dx, dy));
    if (d.dist < 7 || (e.clientX === d.px && e.clientY === d.py)) return;
    const now = performance.now();
    const t = Math.max(0.008, (now - d.at) / 1000);
    const c = (v: number) => Math.max(-2400, Math.min(2400, v));
    vel.x = c((d.px - e.clientX) / t);
    vel.y = c((d.py - e.clientY) / t);
    cam.x = d.camX - dx; cam.y = d.camY - dy;
    d.px = e.clientX; d.py = e.clientY; d.at = now;
    paint();
  });
  const up = (e: PointerEvent) => {
    const d = drag;
    if (!d || d.id !== e.pointerId) return;
    drag = null;
    try { root.releasePointerCapture(e.pointerId); } catch {}
    if (e.type !== 'pointerup') return stop();
    if (d.dist < 7) {
      const id = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-journal-item]')?.dataset.journalItem;
      const it = id ? byId.get(id) : null;
      if (it && !open) { stop(); onOpen(it); }
      return;
    }
    if (performance.now() - d.at < 90 && !raf && !reduced) { lastT = performance.now(); raf = requestAnimationFrame(glide); }
    else stop();
  };
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  root.addEventListener('lostpointercapture', up as EventListener);
  root.addEventListener('click', (e) => { if (e.detail !== 0) { e.preventDefault(); e.stopPropagation(); } }, true);
  root.addEventListener('wheel', (e) => {
    if (e.ctrlKey || open) return;
    e.preventDefault();
    stop();
    touched = true;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? root.clientHeight : 1;
    const shift = e.shiftKey && !e.deltaX;
    cam.x += (shift ? e.deltaY : e.deltaX) * unit;
    cam.y += (shift ? 0 : e.deltaY) * unit;
    paint();
  }, { passive: false });
  root.addEventListener('scroll', () => { root.scrollLeft = 0; root.scrollTop = 0; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); drag = null; } });

  new ResizeObserver(() => {
    const nw = root.clientWidth, nh = root.clientHeight;
    if (!nw || !nh || (nw === W && nh === H)) return;
    const k = latticeScale(nw, nh) / latticeScale(W, H);
    cam.x = cam.x * k + (nw - W) / 2;
    cam.y = cam.y * k + (nh - H) / 2;
    W = nw; H = nh;
    render();
  }).observe(root);

  render();
  return {
    /** Deep link: start on the entry (only before the user has moved the field). */
    focus(id) {
      const it = byId.get(id);
      if (!it || touched) return;
      const l = latticeScale(W, H);
      cam.x = it.x * l; cam.y = it.y * l;
      render();
    },
    setOpen(o) { open = o; if (o) { stop(); drag = null; } },
  };
}
