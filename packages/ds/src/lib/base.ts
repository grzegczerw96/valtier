/** Deploy base path (Astro `base`, e.g. '/valtier' on GitHub Pages; '' at a domain root).
 *  Every root-relative link or public asset goes through `withBase`. */
export const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
export const withBase = (p: string) => (/^(https?:)?\/\//.test(p) || !p.startsWith('/') ? p : BASE + p);
/** Strip the base again (e.g. to look a file up in /public at build time). */
export const stripBase = (p: string) => (BASE && p.startsWith(BASE + '/') ? p.slice(BASE.length) : p);
