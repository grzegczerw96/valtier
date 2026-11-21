/** Phone detail: a full-screen bone sheet that rises 28px into place (360 ms),
 *  scrolls natively and drops away on close (220 ms). */
import { trapFocus } from '@valtier/ds/motion/focus-trap';
import { expanded, type Item } from './layout';
import { fillCommon } from './fill';
import { mountVideo } from './media';

const DEFAULT_BODY = 'Long-form journal copy lands here. The story behind the item — date, place, who was there.';

export interface SheetApi { open(it: Item, withSound: boolean): void; close(): void; readonly isOpen: boolean }

export function createSheet(root: HTMLElement, onClose: () => void): SheetApi {
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const media = q('[data-jr-sheet-media]'), h = q('[data-jr-sheet-h]'), p = q('[data-jr-sheet-p]'), closeBtn = q('[data-jr-sheet-close]');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let isOpen = false, closing = false;
  let unmount: (() => void) | null = null;
  let release: (() => void) | null = null;
  let t = 0;

  closeBtn.addEventListener('click', () => close());

  function open(it: Item, withSound: boolean) {
    unmount?.();
    unmount = null;
    media.replaceChildren();
    media.removeAttribute('style');
    if (it.kind === 'video' && it.video) {
      media.dataset.kind = 'video';
      unmount = mountVideo(media, it.video, it.label, true, withSound);
    } else {
      const ratio = it.width / it.height;
      media.dataset.kind = it.frame === 'polaroid' ? 'polaroid' : 'image';
      media.style.aspectRatio = String(ratio);
      media.style.maxWidth = `calc(55vh * ${ratio})`;
      const img = new Image();
      img.src = it.src;
      img.alt = it.alt;
      img.draggable = false;
      media.append(img);
    }
    h.textContent = it.label;
    p.hidden = !(it.body || !expanded(it));
    p.textContent = it.body ?? DEFAULT_BODY;
    fillCommon(root, it, { brand: '[data-jr-sheet-brand]', rows: '[data-jr-sheet-rows]', ctaWrap: '[data-jr-sheet-cta-wrap]', cta: '[data-jr-sheet-cta]', post: '[data-jr-sheet-post]' }, false);
    root.setAttribute('aria-label', it.label);
    root.scrollTop = 0;
    if (isOpen) return;
    isOpen = true;
    closing = false;
    clearTimeout(t);
    root.hidden = false;
    root.removeAttribute('data-out');
    document.body.classList.add('journal-detail-open');
    requestAnimationFrame(() => requestAnimationFrame(() => root.setAttribute('data-in', '')));
    release = trapFocus(root, { initial: closeBtn, onEscape: () => close() });
  }

  function close() {
    if (!isOpen || closing) return;
    closing = true;
    root.setAttribute('data-out', '');
    root.removeAttribute('data-in');
    t = window.setTimeout(() => {
      isOpen = false;
      closing = false;
      root.hidden = true;
      root.removeAttribute('data-out');
      unmount?.();
      unmount = null;
      document.body.classList.remove('journal-detail-open');
      release?.();
      release = null;
      onClose();
    }, reduced() ? 0 : 220);
  }

  return { open, close, get isOpen() { return isOpen; } };
}
