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
  const t = window.setTimeout(go, 3500);
  return () => {
    done = true;
    window.removeEventListener(VEIL_EVENT, go);
    clearTimeout(t);
  };
}

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
  `(function(d){d.classList.add('js');try{var s=sessionStorage;if(s.getItem('v-transition')==='1'||${firstVisitLoader ? 'true' : 'false'})d.classList.add('veil-on');}catch(e){}setTimeout(function(){if(d.classList.contains('veil-on')&&!d.hasAttribute('data-veil-lifted')){d.classList.remove('veil-on');d.setAttribute('data-veil-lifted','');}},6000);})(document.documentElement);`;
