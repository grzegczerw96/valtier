/** Modal focus handling: keeps Tab inside `root`, calls `onEscape` on Esc and
 *  gives focus back to whatever had it when the trap is released. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls], iframe, [tabindex]:not([tabindex="-1"])';

export function trapFocus(root: HTMLElement, { initial, onEscape }: { initial?: HTMLElement | null; onEscape?: () => void } = {}) {
  const before = document.activeElement as HTMLElement | null;
  const visible = (el: HTMLElement) => !el.closest('[hidden], [inert], [aria-hidden="true"]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const list = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (onEscape) { e.preventDefault(); onEscape(); }
      return;
    }
    if (e.key !== 'Tab') return;
    const els = list();
    if (!els.length) { e.preventDefault(); return; }
    const first = els[0], last = els[els.length - 1];
    const cur = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (cur === first || !root.contains(cur))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (cur === last || !root.contains(cur))) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKey);
  // The target may still be fading in (visibility: hidden can't take focus): retry for ~1 s.
  let tries = 0, raf = 0;
  const place = () => {
    const t = initial ?? list()[0];
    t?.focus({ preventScroll: true });
    if (t && document.activeElement !== t && ++tries < 60) raf = requestAnimationFrame(place);
  };
  raf = requestAnimationFrame(place);
  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey);
    if (before && document.contains(before)) before.focus({ preventScroll: true });
  };
}
