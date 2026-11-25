/** Glitch flicker for small text links: on hover, characters blink out at random
 *  for 13 frames x 32ms with a decaying probability (.38 -> 0). */
import { prefersReducedMotion } from './env';

export function initScramble(el: HTMLElement) {
  const text = el.dataset.scramble || el.textContent || '';
  const inner = document.createElement('span');
  inner.setAttribute('aria-hidden', 'true');
  inner.textContent = text;
  el.setAttribute('aria-label', text);
  el.textContent = '';
  el.append(inner);
  let timer = 0;
  let armed = true;
  el.addEventListener('mouseenter', () => {
    if (!armed || timer || prefersReducedMotion()) return;
    armed = false;
    let f = 0;
    timer = window.setInterval(() => {
      f += 1;
      if (f >= 13) {
        clearInterval(timer);
        timer = 0;
        inner.textContent = text;
        return;
      }
      const p = 0.38 * (1 - f / 13);
      inner.innerHTML = '';
      for (const ch of text) {
        const s = document.createElement('span');
        s.textContent = ch;
        if (ch !== ' ' && Math.random() < p) s.style.opacity = '0';
        inner.append(s);
      }
    }, 32);
  });
  el.addEventListener('mouseleave', () => (armed = true));
}

export function initAllScrambles(scope: ParentNode = document) {
  scope.querySelectorAll<HTMLElement>('[data-scramble]').forEach(initScramble);
}

/** Decode-in: the label resolves left to right out of random glyphs (32 ms frames;
 *  the reveal front moves len/9 characters per frame after a 3-frame hold). It plays
 *  once per `play()`, and re-arms only after `rearm()` (e.g. when the pointer leaves
 *  the row), so jittery hovers don't restart it. */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$+=<>*';

export function createDecode(el: HTMLElement, text = el.textContent || '') {
  let timer = 0;
  let armed = true;
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = 0;
  };
  return {
    play() {
      if (!armed || timer || prefersReducedMotion()) return;
      armed = false;
      let f = 0;
      timer = window.setInterval(() => {
        const front = ((f += 1) - 3) / 9 * text.length;
        el.textContent = Array.from(text, (ch, i) => (ch === ' ' || i < front ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
        if (front >= text.length) {
          stop();
          el.textContent = text;
        }
      }, 32);
    },
    rearm() {
      armed = true;
    },
    reset() {
      stop();
      armed = true;
      el.textContent = text;
    },
  };
}
