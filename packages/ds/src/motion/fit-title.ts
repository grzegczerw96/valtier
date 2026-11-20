/** Fits a single-line headline to its box: measures it at 100px and scales the
 *  font-size so the (squeezed) width equals the box's content width. Re-fits on
 *  resize and when web fonts finish loading. */
const titles = new Set<HTMLElement>();
let bound = false;
let raf = 0;

function fit(box: HTMLElement) {
  const text = box.querySelector<HTMLElement>('[data-lane-title-text]');
  if (!text) return;
  const squeeze = parseFloat(getComputedStyle(box).getPropertyValue('--squeeze')) || 1;
  text.style.setProperty('transition', 'none', 'important');
  text.style.fontSize = '100px';
  const w = text.offsetWidth || 1; // layout width (ignores the scaleX transform)
  const cs = getComputedStyle(box);
  const avail = box.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  text.style.fontSize = `${Math.max(48, (avail / (w * squeeze)) * 100)}px`;
  text.style.removeProperty('transition');
}

const refit = () => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => titles.forEach(fit));
};

export function initFitTitle(box: HTMLElement) {
  if (titles.has(box)) return;
  titles.add(box);
  fit(box);
  if (bound) return;
  bound = true;
  window.addEventListener('resize', refit);
  document.fonts?.ready.then(refit);
  document.fonts?.addEventListener('loadingdone', refit);
}

export function initAllFitTitles(scope: ParentNode = document) {
  scope.querySelectorAll<HTMLElement>('[data-lane-title]').forEach(initFitTitle);
}
