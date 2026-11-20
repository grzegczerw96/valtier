/** Page veil coordination: intro animations wait until the loader / transition
 *  veil has lifted, so nothing plays underneath it.
 *  `html.veil-on` is set by a tiny inline <head> script (see Base layout) when the
 *  page must open covered: after an internal transition, or on a first visit
 *  when the optional loader is enabled. */
export const VEIL_EVENT = 'v:veil-lift';

export const isVeiled = () =>
  document.documentElement.classList.contains('veil-on') && !document.documentElement.hasAttribute('data-veil-lifted');

export function afterVeil(fn: () => void) {
  if (!isVeiled()) {
    fn();
    return () => {};
  }
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    fn();
  };
  window.addEventListener(VEIL_EVENT, go, { once: true });
  // Safety net if the veil never lifts; waits longer while something holds it.
  const t0 = performance.now();
  let t = 0;
  const check = () => (veilHeld() && performance.now() - t0 < 10000 ? (t = window.setTimeout(check, 250)) : go());
  t = window.setTimeout(check, 3500);
  return () => {
    done = true;
    window.removeEventListener(VEIL_EVENT, go);
    clearTimeout(t);
  };
}

/** Keeps the first-visit loader up until `p` settles (e.g. the WebGL hero is ready),
 *  so an intro never starts underneath it. Capped by the loader's own maximum. */
type Hold = { done: boolean };
declare global { interface Window { __vHolds?: Hold[] } }
export function holdVeil(p: Promise<unknown>) {
  const h: Hold = { done: false };
  (window.__vHolds ??= []).push(h);
  p.then(() => (h.done = true), () => (h.done = true));
}
export function veilHeld() { return !!window.__vHolds?.some((h) => !h.done); }

/** True when the page was reached through an internal page transition (wipe), false
 *  on a hard load (first-visit loader or none). Some intros only play on transitions. */
export const arrivedByTransition = () => document.documentElement.getAttribute('data-arrival') === 'transition';

export function liftVeil() {
  document.documentElement.setAttribute('data-veil-lifted', '');
  document.documentElement.classList.remove('veil-on');
  window.dispatchEvent(new Event(VEIL_EVENT));
}

/** Inline-able bootstrap (stringified into <head>): decides whether the page opens veiled. */
export const VEIL_BOOT = (firstVisitLoader: boolean) =>
  // vDefer/vIdle: page-wide idle scheduler used by every component bootstrap
  // (first slot after the first frame, one initialiser per idle slot).
  `(function(w){var q=[],on=0,ric=w.requestIdleCallback?function(f){requestIdleCallback(f,{timeout:1000})}:function(f){setTimeout(f,32)};` +
  `function pump(dl){do{var f=q.shift();if(!f)break;try{var r=f();if(r&&r.catch)r.catch(function(e){console.error(e)})}catch(e){console.error(e)}}while(q.length&&dl&&!dl.didTimeout&&dl.timeRemaining()>12);if(q.length)ric(pump);else on=0}` +
  `w.vDefer=function(f){q.push(f);if(on)return;on=1;requestAnimationFrame(function(){setTimeout(function(){ric(pump)},0)})};` +
  `w.vIdle=function(){return new Promise(function(r){ric(function(){r()})})};})(window);` +
  `(function(d){d.classList.add('js');d.setAttribute('data-arrival','load');try{var s=sessionStorage,t=s.getItem('v-transition')==='1';if(t)d.setAttribute('data-arrival','transition');if(t||${firstVisitLoader ? 'true' : 'false'})d.classList.add('veil-on');}catch(e){}setTimeout(function(){if(d.classList.contains('veil-on')&&!d.hasAttribute('data-veil-lifted')){d.classList.remove('veil-on');d.setAttribute('data-veil-lifted','');}},6000);})(document.documentElement);`;
