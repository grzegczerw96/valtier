/** Idle scheduler. The implementation lives in the inline <head> boot script
 *  (VEIL_BOOT in veil.ts) so component bootstraps need no static imports and can
 *  be inlined into the HTML; this module just forwards to it. */
declare global {
  interface Window { vDefer(fn: () => unknown): void; vIdle(): Promise<void> }
}
export const deferInit = (fn: () => unknown) => window.vDefer(fn);
export const idle = () => window.vIdle();
