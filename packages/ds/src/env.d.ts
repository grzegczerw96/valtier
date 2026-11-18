// Globals installed by the inline <head> boot script (see motion/veil.ts VEIL_BOOT).
interface Window {
  vDefer(fn: () => unknown): void;
  vIdle(): Promise<void>;
}
