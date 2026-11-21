/** Inline clip for an open entry: native controls, a "Loading video" pill while it
 *  buffers ("Still loading video…" after 10 s), a retry on error, and the site's
 *  ambient bed ducks while the clip plays with sound. Like the reference's player
 *  it starts on open, with sound only when the site's sound is on. */
export function mountVideo(host: HTMLElement, v: { src: string; poster: string }, title: string, autoplay: boolean, withSound = false) {
  const video = document.createElement('video');
  video.controls = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.poster = v.poster;
  video.setAttribute('disableremoteplayback', '');
  video.setAttribute('aria-label', title);
  video.src = v.src;

  const status = document.createElement('div');
  status.className = 'jr-status';
  status.innerHTML = '<span role="status"><i aria-hidden="true"></i><b>Loading video</b></span>';
  status.hidden = true;
  const label = status.querySelector('b')!;
  let slow = 0;
  const loading = (on: boolean) => {
    status.hidden = !on;
    clearTimeout(slow);
    label.textContent = 'Loading video';
    if (on) slow = window.setTimeout(() => (label.textContent = 'Still loading video…'), 10000);
  };

  const retry = document.createElement('div');
  retry.className = 'jr-status';
  retry.hidden = true;
  retry.innerHTML = '<button type="button" class="jr-retry">Retry video</button>';
  retry.style.pointerEvents = 'auto';
  retry.querySelector('button')!.addEventListener('click', () => { retry.hidden = true; video.load(); });

  let ducked = false;
  let duck: ((on: boolean) => void) | null = null;
  import('@valtier/ds/motion/sound').then((m) => (duck = m.duck));
  const setDuck = (on: boolean) => { if (on !== ducked) { ducked = on; duck?.(on); } };
  const audible = () => !video.paused && !video.muted && video.volume > 0;

  video.addEventListener('loadstart', () => { if (autoplay) loading(true); retry.hidden = true; });
  for (const ev of ['loadeddata', 'canplay', 'playing', 'seeked', 'pause', 'ended']) video.addEventListener(ev, () => loading(false));
  for (const ev of ['waiting', 'seeking']) video.addEventListener(ev, () => loading(!video.paused));
  video.addEventListener('error', () => { loading(false); retry.hidden = false; });
  for (const ev of ['play', 'pause', 'ended', 'volumechange']) video.addEventListener(ev, () => setDuck(audible()));

  host.append(video, status, retry);
  if (autoplay) {
    video.muted = !withSound;
    video.play().catch(() => {
      // autoplay with sound refused: try muted, else wait for the user
      video.muted = true;
      video.play().catch(() => loading(false));
    });
  }
  return () => {
    clearTimeout(slow);
    setDuck(false);
    video.pause();
    video.removeAttribute('src');
    video.load();
    host.replaceChildren();
  };
}
