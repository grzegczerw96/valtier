# Valtier — On-Field, Home, Off-Field

A fictional athlete site (Nico Valtier, #18, Northmark Wolves) whose pages
reproduce the layout, motion system, timings and behaviour of a reference design,
with its own brand, copy, data, fonts and media. Built with Astro (static), GSAP +
ScrollTrigger and Lenis; no client framework.

```
packages/ds/        @valtier/ds — the design system (separate package)
  src/tokens/       tokens.css: colour, type scale, easings, layout units, z-index, themes
  src/styles/       fonts.css (self-hosted, metric-matched fallbacks), base.css (reset, type roles, DotReveal, bg layers)
  src/motion/       framework-free TS: scroll (Lenis), dot-reveal, transitions/veil, menu, sound,
                    drift marquee (+ pause/centre), snap-rail, image-rail, type-reveal, fit-title,
                    film player, cursor, scramble, tone switching, inview helpers
  src/components/   Astro: SiteNav (+menu), Footer (+panel, signature, partners), Veil, SoundToggle,
                    Cursor, BgLayers, Button, DotReveal, Logo, SocialIcon, Boot, LaneTitle,
                    TypeReveal, ImageRail, BrandTicker, Wordmark, PhoneMock, PieceMarquee
  scripts-build-fonts.py   rebuilds the subset webfonts from Fontsource sources
apps/web/           the site
  src/content/      on-field.ts, home.ts, off-field.ts — every number and string on each page
  src/components/   on-field/, home/, off-field/ — page sections
  src/pages/        index, on-field, off-field, design-system (living style guide), placeholders for the other nav items
  scripts/          gen-textures.py (procedural pebble/grass/light), gen-placeholders.py, serve.mjs
```

## Run

```bash
npm install
npm run dev        # http://localhost:4321/valtier/on-field
npm run build      # static output in apps/web/dist
node apps/web/scripts/serve.mjs 4330   # production-like server (brotli, caching): http://127.0.0.1:4330/valtier/on-field
```

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds the site and publishes it on
GitHub Pages at https://grzegczerw96.github.io/valtier/on-field.

The site lives under the base path `/valtier` (`base` in `apps/web/astro.config.mjs`). Pass every
root-relative link or `/public` asset through `withBase()` from `@valtier/ds/lib/base`. CSS
`url('/…')` is rewritten automatically. To serve from a domain root, set `base` to `/` and change
`BASE` in `apps/web/scripts/serve.mjs`.

## Adding a page

Create `apps/web/src/pages/<name>.astro`, wrap it in `layouts/Base.astro`, give each top-level
section a `data-tone` (`dark` / `purple` / `light`) and use DS components. Delete the slug from
`pages/[slug].astro` (the holding page). Pick a footer from `footerVariants` in `site.config.ts`.

## Fonts (free, OFL)

Chosen by pixel-overlap matching against the reference faces (IoU, cap-height normalised):

| Role | Reference (commercial) | Replacement | Notes |
|---|---|---|---|
| Display / numerals | Beachwood Variable (Adobe) | **Saira**, pinned to wdth 50, wght 400–800 | 28 KB subset |
| Body / headings | ABC Diatype 400/800 (Dinamo) | **Hanken Grotesk** variable | 19 KB |
| Labels | ABC Diatype Mono 500 | **IBM Plex Mono 500** | IoU 0.86 |
| Hero title | NuMono Free (licence unclear) | **Audiowide** | |

## Deliberate fixes vs. the reference

- **Loader** — as in the reference, every hard load opens on the logo loader (≥ 900 ms), then the slanted
  wipe reveals the page and the hero CRT powers on. `features.firstVisitLoader = false` in `site.config.ts`
  skips it (better FCP/LCP/Speed Index); page-to-page wipes are unchanged either way.
- **Motion verified frame-by-frame** against the reference (CDP screencast): hero intro, quote reveal, menu,
  record hover/tabs, stats scrub, footer invitation, CTA hover and page transition match in timing and easing.
- **Third-party marks** are removed from stock media (no Nike/UEFA cleats; maker lettering painted out of the helmet).
- **Contrast**: muted text raised from 45% to 52% bone (WCAG AA); minimum 12 px for small labels on phones.
- **Phones**: season axis no longer clips the last year; carousels hide inactive slides from assistive tech.
- **Weight**: ~75 KB JS gzip (reference ~300 KB+), 73 KB fonts (reference ~260 KB), 87 KB texture tile (reference 325 KB),
  sections below the fold initialise lazily, hero video attaches after `load`.

## Media

Photos and the hero clip come from Pexels (sources and the rebuild script are listed in `apps/web/MEDIA.md`).
The hero clip is fetched on the visitor's first interaction; its first frame is the poster, so the swap is
seamless and no video bytes compete with first paint. `scripts/gen-placeholders.py` can regenerate stand-ins.
