/** Full-screen film player (phones): a modal dialog with a native <video>, close
 *  button, Escape / back-gesture friendly, page scroll locked while open. */
import { duck } from './sound';

let open: (() => void) | null = null;

export function openFilm({ src, poster, title }: { src: string; poster?: string; title: string }) {
  open?.();
  const prevFocus = document.activeElement as HTMLElement | null;
  const dlg = document.createElement('div');
  dlg.className = 'v-film';
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('aria-modal', 'true');
  dlg.setAttribute('aria-label', title);
  dlg.innerHTML = `<button type="button" class="v-film__close" aria-label="Close film"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
    <video class="v-film__video" controls playsinline preload="auto" disableremoteplayback></video>`;
  const video = dlg.querySelector('video')!;
  video.src = src;
  if (poster) video.poster = poster;
  video.setAttribute('aria-label', title);
  const html = document.documentElement;
  const prevOverflow = html.style.overflow;
  html.style.overflow = 'hidden';
  document.body.append(dlg);
  const close = () => {
    if (open !== close) return;
    open = null;
    video.pause();
    video.removeAttribute('src');
    video.load();
    dlg.remove();
    duck(false);
    html.style.overflow = prevOverflow;
    window.removeEventListener('keydown', onKey);
    prevFocus?.focus?.({ preventScroll: true });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  window.addEventListener('keydown', onKey);
  dlg.querySelector<HTMLButtonElement>('.v-film__close')!.addEventListener('click', close);
  video.addEventListener('ended', close);
  open = close;
  duck(true);
  dlg.querySelector<HTMLButtonElement>('.v-film__close')!.focus({ preventScroll: true });
  video.play().catch(() => {});
  return close;
}
