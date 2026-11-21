/** Journal geometry (pure functions, all in CSS px). */
import type { JournalItem } from '../../content/journal';
import { CONTENT_MAX, pageX, vu } from '@valtier/ds/motion/env';

export type Item = JournalItem;
export interface Field { tileW: number; tileH: number; shearX: number; shearY: number }
export interface Lattice { w: number; h: number; sx: number; sy: number }

/** Video and article entries get the wide card (the media sits in the card). */
export const expanded = (it: Pick<Item, 'kind'>) => it.kind === 'video' || it.kind === 'post';

/** Desktop field scale: 1 at 1440 x 900, 0.45 .. 1.8. */
export const fieldScale = (w: number, h: number) => Math.min(1.8, Math.max(0.45, Math.min(Math.min(w, CONTENT_MAX) / 1440, h / 900)));

/** Phone lattice scale. */
export const latticeScale = (w: number, h = Infinity) => Math.max(0.3, Math.min(Math.max(0.4, Math.min(0.54, w / 900)), (0.44 * h) / 620));

/** Nearest lattice copy of point (ox, oy) to (x, y). */
export function nearest(ox: number, oy: number, x: number, y: number, L: Lattice) {
  let r = Math.round((y - oy) / L.h);
  let c = Math.round((x - ox - r * L.sx) / L.w);
  r = Math.round((y - oy - c * L.sy) / L.h);
  c = Math.round((x - ox - r * L.sx) / L.w);
  return { x: ox + c * L.w + r * L.sx, y: oy + c * L.sy + r * L.h };
}

const gutter = (w: number) => Math.round(Math.max(24, Math.min(0.03 * w, 64)));
const content = (w: number) => ({ x: pageX(w), w: Math.min(w, CONTENT_MAX) });

export const CARD_W = 539;
const CARD_MIN = 0.7792207792207793;

export interface CardLayout { mobile: boolean; scale: number; width: number; left: number; topOffset: number; bottomMargin: number; restTopOffset: number }

/** Where the hero rests vertically (between the title and the bottom gutter). */
export function restBox(w: number, h: number) {
  const r = content(w).w;
  const bottom = h - gutter(r);
  return { top: Math.max(Math.max(72, 120 * Math.min(1, h / 800)), bottom - 0.6 * r), bottom };
}

/** Detail card box: left column, scaled down on small screens. */
export function cardLayout(w: number, wide: boolean, h: number): CardLayout {
  if (w < 768) {
    const width = Math.min(CARD_W, w - 32);
    return { mobile: true, scale: 1, width, left: (w - width) / 2, topOffset: 16, bottomMargin: 16, restTopOffset: 16 };
  }
  const c = content(w);
  const g = gutter(c.w);
  const span = 100 * vu(w, h);
  const full = wide ? 880 : CARD_W;
  const want = wide ? Math.min(full, 0.45 * span) : Math.min(0.45 * c.w, Math.max(420, Math.min(720, span / 3)));
  const min = wide ? 0.72 : CARD_MIN;
  const k = want / full;
  const scale = Math.max(min, k);
  return { mobile: false, scale, width: k < min ? want / scale : full, left: c.x + g, topOffset: 24, bottomMargin: g, restTopOffset: restBox(w, h).top };
}

/** The hero's box: centred in the space right of the card. */
export function heroBox(w: number, h: number, wide: boolean) {
  const L = cardLayout(w, wide, h);
  if (L.mobile) {
    const n = Math.max(16, h - (wide ? 710 : 500) - 16);
    return { cx: 0.5 * w, cy: Math.max(0.46 * n, 0.15 * h), boxW: 0.84 * w, boxH: Math.max(0.72 * n, 0.2 * h) };
  }
  const c = content(w);
  const right = L.left + L.width * L.scale;
  const free = c.x + c.w - right;
  const { top, bottom } = restBox(w, h);
  return { cx: right + 0.5 * free, cy: (top + bottom) / 2, boxW: 0.62 * free, boxH: (bottom - top) * 0.8 };
}

/** Scale that fits an item (already at field scale) into the hero box. */
export function heroScale(it: { width: number; height: number }, w: number, h: number, wide: boolean) {
  const { boxW, boxH } = heroBox(w, h, wide);
  return Math.max(0.45, Math.min(Math.min(boxW / it.width, boxH / it.height), 2.4));
}
