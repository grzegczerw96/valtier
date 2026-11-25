/** Shared-element flight between two layouts: fixed clones of the source tiles fly
 *  to their targets (position, size and corner radius), staggered 70 ms, 620 ms each
 *  on an ease-out (1 - (1 - t)^3.4). Targets are re-measured every frame, so they can
 *  still be moving (an accordion opening). Sources without a target fade out instead
 *  (240 ms, 40 ms stagger, 10 px drop). */
const ease = (t: number) => 1 - Math.pow(1 - t, 3.4);
export const FLIGHT = { ms: 620, stagger: 70, fadeMs: 240, fadeStagger: 40 } as const;

export function cloneTile(node: Element, r: DOMRect, radius: number) {
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;z-index:80;pointer-events:none;overflow:hidden;left:0;top:0;box-shadow:0 6px 18px rgba(26,14,48,0.28);' +
    `border-radius:${radius}px;width:${r.width}px;height:${r.height}px;transform:translate(${r.left}px,${r.top}px);`;
  const media = node.querySelector('video[data-playing], img, video');
  if (media) {
    const isVideo = media.tagName === 'VIDEO';
    const m = document.createElement(isVideo ? 'video' : 'img') as HTMLImageElement | HTMLVideoElement;
    m.src = (media as HTMLImageElement).currentSrc || (media as HTMLImageElement).src;
    if (m instanceof HTMLVideoElement) {
      m.muted = true; m.autoplay = true; m.loop = true; m.playsInline = true;
      m.currentTime = (media as HTMLVideoElement).currentTime || 0;
    }
    m.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    box.append(m);
  }
  document.body.append(box);
  return box;
}

export function fly(pairs: { from: DOMRect; node: Element; target: HTMLElement }[], { radius = [3, 0] as [number, number], hideTargets = true } = {}) {
  return new Promise<void>((resolve) => {
    if (!pairs.length) return resolve();
    const [r0, r1] = radius;
    const runs = pairs.map((p, i) => {
      if (hideTargets) p.target.style.opacity = '0';
      return { ...p, clone: cloneTile(p.node, p.from, r0), delay: FLIGHT.stagger * i };
    });
    const total = FLIGHT.ms + FLIGHT.stagger * (runs.length - 1);
    const t0 = performance.now();
    let raf = 0, done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      // Hand over only once the target's own image can paint (it may still be loading
      // the full-size file while the clone shows the thumbnail); capped at 700 ms.
      for (const r of runs) {
        const img = r.target.querySelector('img');
        let handed = false;
        const hand = () => {
          if (handed) return;
          handed = true;
          if (hideTargets) r.target.style.opacity = '';
          r.clone.remove();
        };
        if (img && !img.complete) {
          img.addEventListener('load', hand, { once: true });
          img.addEventListener('error', hand, { once: true });
          window.setTimeout(hand, 700);
        } else hand();
      }
      resolve();
    };
    const frame = (now: number) => {
      for (const r of runs) {
        const k = ease(Math.min(1, Math.max(0, (now - t0 - r.delay) / FLIGHT.ms)));
        const b = r.target.getBoundingClientRect();
        const x = r.from.left + (b.left - r.from.left) * k, y = r.from.top + (b.top - r.from.top) * k;
        r.clone.style.transform = `translate(${x}px,${y}px)`;
        r.clone.style.width = `${r.from.width + (b.width - r.from.width) * k}px`;
        r.clone.style.height = `${r.from.height + (b.height - r.from.height) * k}px`;
        r.clone.style.borderRadius = `${r0 + (r1 - r0) * k}px`;
      }
      if (now - t0 < total) raf = requestAnimationFrame(frame);
      else finish();
    };
    raf = requestAnimationFrame(frame);
    window.setTimeout(finish, total + 120);
  });
}

export function fadeAway(items: { from: DOMRect; node: Element }[], radius = 3) {
  items.forEach(({ from, node }, i) => {
    const c = cloneTile(node, from, radius);
    c.style.transition = `opacity ${FLIGHT.fadeMs}ms ease, transform ${FLIGHT.fadeMs}ms ease`;
    c.style.transitionDelay = `${FLIGHT.fadeStagger * i}ms`;
    requestAnimationFrame(() => {
      c.style.opacity = '0';
      c.style.transform = `translate(${from.left}px,${from.top + 10}px)`;
    });
    window.setTimeout(() => c.remove(), FLIGHT.fadeMs + 100 + FLIGHT.fadeStagger * i);
  });
}
