/** One entry on the field (a <button>): the art (cut-out, polaroid or card), an
 *  optional light sweep masked to the art, and on desktop a pointer tilt and a
 *  WebGL depth layer that mounts only while the entry is near the viewport. */
import type { Item } from './layout';

export type ItemState = 'idle' | 'active' | 'dimmed';
const EASE_T = 'cubic-bezier(0.16,1,0.3,1)';
const EASE_F = 'cubic-bezier(0.65,0.05,0.36,1)';

export interface ItemView {
  el: HTMLButtonElement;
  item: Item;
  setState(s: ItemState, heroScale?: number): void;
  /** WebGL depth slide on/off (desktop only). */
  setDepth(on: boolean): void;
  destroy(): void;
}

const depthPool = { live: 0, max: 10 };

export function createItem(item: Item, opts: { lightweight: boolean; tabIndex?: number }): ItemView {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'jr-item';
  el.dataset.journalItem = item.id;
  el.dataset.soundCard = '';
  el.setAttribute('aria-label', item.label);
  el.tabIndex = opts.tabIndex ?? 0;
  el.style.width = `${item.width}px`;
  el.style.height = `${item.height}px`;

  const tilt = document.createElement('div');
  tilt.className = 'jr-item__tilt';
  if (item.radius) {
    tilt.dataset.round = '';
    tilt.style.borderRadius = `${(item.width * item.radius) / 100}px`;
  }
  el.append(tilt);

  const img = new Image();
  img.decoding = 'async';
  img.loading = 'lazy';
  img.draggable = false;
  img.alt = '';
  img.src = item.src;

  if (item.frame === 'polaroid') {
    const p = document.createElement('div');
    p.className = 'jr-item__polaroid';
    const grain = document.createElement('span');
    grain.className = 'jr-grain';
    grain.setAttribute('aria-hidden', 'true');
    p.append(img, grain);
    tilt.append(p);
  } else {
    if (item.depth && !opts.lightweight) img.className = 'jr-item__img--depth';
    tilt.append(img);
  }

  const sheenOn = item.sheen && !item.depth && !opts.lightweight;
  if (sheenOn) {
    const s = document.createElement('span');
    s.className = 'jr-sheen';
    s.setAttribute('aria-hidden', 'true');
    if (item.frame !== 'polaroid') {
      s.style.setProperty('-webkit-mask-image', `url("${item.src}")`);
      s.style.setProperty('mask-image', `url("${item.src}")`);
    }
    tilt.append(s);
  }

  let state: ItemState = 'idle';
  let prev: ItemState = 'idle';
  let hero = 1;
  let hover = false;
  const polaroid = item.frame === 'polaroid';

  const paint = () => {
    const active = state === 'active', dimmed = state === 'dimmed';
    const back = prev !== 'idle' && state === 'idle';
    const lifted = hover && !active && !dimmed;
    const fd = back ? 0.3 : active || dimmed ? 0.7 : 0.35;
    const rot = active ? 0 : item.rotation;
    el.style.transform = `rotate(${rot}deg) scale(${active ? hero : 1})`;
    const shadow = polaroid
      ? lifted ? 'drop-shadow(0 30px 52px rgba(0,0,0,0.5))' : 'drop-shadow(0 14px 26px rgba(0,0,0,0.4))'
      : lifted ? 'drop-shadow(0 36px 62px rgba(0,0,0,0.55))' : 'drop-shadow(0 20px 34px rgba(0,0,0,0.45))';
    el.style.filter = `blur(${dimmed ? 6 : 0}px) brightness(${dimmed ? 0.78 : 1}) saturate(${dimmed ? 0.85 : 1}) ${shadow}`;
    el.style.opacity = dimmed ? '0.5' : '1';
    el.style.zIndex = active ? '40' : dimmed ? '1' : '10';
    el.style.transition = `transform ${back ? 0.42 : 0.9}s ${EASE_T}, filter ${fd}s ${EASE_F}, opacity ${fd}s ${EASE_F}`;
    el.style.pointerEvents = active ? 'none' : '';
    tilt.style.setProperty('--jj-lift', lifted ? '1.09' : '1');
    if (lifted) el.dataset.journalLifted = 'true';
    else delete el.dataset.journalLifted;
    slide?.setLight(item.sheen && lifted);
  };

  if (!opts.lightweight) {
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      hover = true;
      paint();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || state !== 'idle') return;
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (!item.depth) {
        tilt.style.setProperty('--jj-rx', `${(-8 * ny).toFixed(2)}deg`);
        tilt.style.setProperty('--jj-ry', `${(10 * nx).toFixed(2)}deg`);
      }
      if (item.sheen) tilt.style.setProperty('--jj-mxf', ((nx + 1) / 2).toFixed(3));
    });
    el.addEventListener('pointerleave', () => {
      hover = false;
      tilt.style.setProperty('--jj-rx', '0deg');
      tilt.style.setProperty('--jj-ry', '0deg');
      paint();
    });
  }

  // ---- depth slide
  let slide: { setLight(on: boolean): void; destroy(): void } | null = null;
  let host: HTMLDivElement | null = null;
  let token = 0;
  const mountDepth = () => {
    if (!item.depth || slide || host || depthPool.live >= depthPool.max) return;
    depthPool.live++;
    const my = ++token;
    host = document.createElement('div');
    host.className = 'jr-item__depth';
    host.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas');
    host.append(canvas);
    tilt.append(host);
    import('@valtier/ds/motion/depth-gl').then(async ({ createDepthSlide }) => {
      if (my !== token || !host) return;
      const s = await createDepthSlide(canvas, {
        src: item.depth!.src, depth: item.depth!.map, aspect: item.width / item.height, overscan: 1, bleed: 0.18, dispScale: 0.18,
        onReady: () => { if (my === token) el.dataset.depthReady = ''; },
      });
      if (my !== token || !host) { s?.destroy(); return; }
      if (!s) { unmountDepth(); return; }
      slide = s;
      paint();
    });
  };
  const unmountDepth = () => {
    if (!host) return;
    token++;
    slide?.destroy();
    slide = null;
    host.remove();
    host = null;
    depthPool.live--;
    delete el.dataset.depthReady;
  };

  paint();
  return {
    el,
    item,
    setState(s, scale = hero) {
      if (s === state && scale === hero) return;
      prev = state;
      state = s;
      hero = scale;
      paint();
      prev = state;
    },
    setDepth(on) {
      if (on) mountDepth();
      else unmountDepth();
    },
    destroy() {
      unmountDepth();
      el.remove();
    },
  };
}
