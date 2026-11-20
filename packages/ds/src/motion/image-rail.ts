/** Behaviour for ImageRail.astro.
 *  Desktop: drift track (scroll-coupled, draggable). Video tiles preview muted
 *  while on screen; a click glides the tile to the centre, holds the rail and
 *  plays it from the start; a second click, the end of the clip, or scrolling it
 *  under half out of view stops it and lets the rail drift on.
 *  Phones: looping snap rail; video tiles open the full-screen film player. */
import { initDrift } from './drift';
import { initSnapRail } from './snap-rail';
import { isPhone, prefersReducedMotion } from './env';
import { openFilm } from './film';

function previewWhenVisible(videos: HTMLVideoElement[]) {
  if (prefersReducedMotion()) return () => {};
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target as HTMLVideoElement;
      if (v.dataset.active) continue;
      if (e.isIntersecting) {
        if (!v.getAttribute('src') && v.dataset.src) v.src = v.dataset.src;
        v.play().catch(() => {});
      } else if (!v.paused) v.pause();
    }
  }, { rootMargin: '10% 0px' });
  videos.forEach((v) => io.observe(v));
  return () => io.disconnect();
}

export function initImageRail(rail: HTMLElement) {
  if ((rail as any)._irail) return;
  (rail as any)._irail = true;

  if (isPhone()) {
    const list = rail.querySelector<HTMLElement>('[data-irail-phone]');
    if (list) initSnapRail(list, { loop: true });
    rail.querySelectorAll<HTMLButtonElement>('[data-irail-film]').forEach((b) =>
      b.addEventListener('click', () => openFilm({ src: b.dataset.src!, poster: b.dataset.poster, title: b.dataset.title || '' })),
    );
    return;
  }

  const track = rail.querySelector<HTMLElement>('[data-irail-track]');
  if (!track) return;
  const drift = initDrift(track, { baseSpeed: parseFloat(rail.dataset.speed || '0.35') });
  const tiles = Array.from(track.querySelectorAll<HTMLElement>('[data-irail-video]'));
  const videos = tiles.map((t) => t.querySelector('video')!);
  previewWhenVisible(videos);

  let active: HTMLElement | null = null;
  let watch: IntersectionObserver | null = null;

  const stop = () => {
    if (!active) return;
    const t = active;
    active = null;
    watch?.disconnect();
    watch = null;
    const v = t.querySelector('video')!;
    delete v.dataset.active;
    v.loop = true;
    v.muted = true;
    t.classList.remove('is-playing');
    drift.resume();
  };

  const twin = (t: HTMLElement) => {
    const half = tiles.length / 2;
    const i = tiles.indexOf(t);
    return tiles[(i + half) % tiles.length];
  };

  tiles.forEach((tile) => {
    const v = tile.querySelector('video')!;
    v.addEventListener('ended', () => tile === active && stop());
    tile.querySelector('button')?.addEventListener('click', (e) => {
      if ((e as MouseEvent).detail > 0 && drift.dragDistance() > 6) return;
      if (active && (active === tile || active === twin(tile))) {
        stop();
        return;
      }
      stop();
      const { flipped } = drift.centerOn(tile);
      const t = flipped ? twin(tile) : tile;
      drift.pause();
      active = t;
      const tv = t.querySelector('video')!;
      tv.dataset.active = '1';
      if (!tv.getAttribute('src') && tv.dataset.src) tv.src = tv.dataset.src;
      tv.loop = false;
      tv.muted = false;
      tv.currentTime = 0;
      t.classList.add('is-playing');
      tv.play().catch(() => stop());
      // Stop once the playing tile drops under half visible (after the glide).
      setTimeout(() => {
        if (active !== t) return;
        watch = new IntersectionObserver(([en]) => {
          if (en && en.intersectionRatio < 0.5 && !drift.isCentering()) stop();
        }, { threshold: [0, 0.5, 1] });
        watch.observe(t);
      }, 750);
    });
  });
}
