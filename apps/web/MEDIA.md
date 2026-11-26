# Media manifest

Drop real files in place of the generated stand-ins, keeping names. WebP (q≈70) for stills,
H.264 MP4 (+ optional WebM) for video. "Cut-out" = transparent background (WebP with alpha).

| File | Size (px) | Type | Used in |
|---|---|---|---|
| hero.mp4 | 1920×1080, ≤ 6 MB, 8–15 s loop, muted | video | Hero CRT screen (desktop) |
| hero-phone.mp4 | 720×1280, ≤ 3 MB | video | Hero (phones) |
| hero-poster.webp / hero-poster-phone.webp | 1600×900 / 780×1400 | photo | Hero first frame + LCP |
| football.webp | 600×377 | cut-out | Ball flying through the stats pin |
| gloves.webp | 1079×1071 | cut-out | Gloves catching the ball |
| career.webp | 938×1386 | photo | "Pro Career" portrait |
| records/r01–r16.webp | 608×810 | photo | Record cards (shown as ASCII, photo on hover) |
| influence-field.webp | 1440×1078 | photo | Floodlit field, 50-yard line, dark |
| influence-player.webp | 660×660 | cut-out | Player celebrating |
| cleats/c01–c10.webp, cleat-gold.webp | 528×472 | cut-out | Cleats marquee, footer trophy |
| reels/reel-01–09.webp | 438×856 | photo (9:16) | Reel thumbnails (add `video` in content to play clips) |
| footer-player.webp | 1200×1200 | cut-out | Footer portrait (player in the left half, slid right by the footer) |
| crest.svg | vector | logo | Team crest next to "18" |

## Current sources (Pexels licence — free use, modification allowed, no attribution required)

Rebuild everything with `python apps/web/scripts/process-media.py <dir>` where `<dir>/photos/<id>.jpg`
and `<dir>/video/<id>.mp4` are the originals below (cut-outs use rembg 2.0.50, model isnet-general-use).
Brand marks are painted out in the script (`clean_helmet`; `clean_footer_player` inpaints with OpenCV,
installed with rembg, and re-adds the photo's grain). To re-apply the footer clean-up to the published file without the source photo:
`python apps/web/scripts/process-media.py - footer_clean`; then rebuild `journal/back-sticker.webp`, which is
cut from it (`gen-journal.py`, see Journal below).

| Slot | Pexels id(s) |
|---|---|
| hero.mp4, hero-phone.mp4, posters | video 5423490 (first frame = posters) |
| career.webp | 16545258 |
| records r01–r16 | 274577, 39619539, 1476171, 16545262, 263731, 13141525, 159549, 264305, 13141532, 16545275, 35911832, 159662, 13883304, 13141521, 1349531, 32057260 |
| reels 01–09 | 31853532, 34722017, 13141528, 32116679, 31853539, 37234656, 10799811, 13141533, 26707860 |
| influence-field.webp | 36573287 (darkened) |
| influence-player.webp | 159515 (cut-out) |
| footer-player.webp | 39170961 (cut-out; helmet maker's "VICIS" lettering and shell badge painted out by `clean_footer_player`) |
| football.webp | 26707860 (cut-out, tee removed) |
| gloves.webp | 13141533 (cut-out: helmet in gloved hand — no receiver-glove shots on Pexels) |
| cleats c01–c10, cleat-gold | 32573999, 32574015, 32574010 (cut-outs + hue-rotated / gilded colourways) |
| hero/portrait (Home) | 9573696 |
| home/partner-halo, home/partner-volta (Home) | 3394666, 34198837 |
| home/partner-cleat (Home) | 27299906 |

Photo URLs: `https://www.pexels.com/photo/<id>/` · video: `https://www.pexels.com/video/<id>/`

## Home page

| File | Made by | Notes |
|---|---|---|
| cards/card-01–05.webp | `scripts/gen-cards.py` | trading cards: rembg cut-out of existing photos (career, r10, reel-02, r16, reel-03) on a violet field, gold dust, bevelled gold frame |
| hero/portrait.webp, portrait-depth.webp, portrait-lens.webp | `scripts/gen-hero.py` | WebGL depth portrait from Pexels 9573696 (top 62% of the frame, BiRefNet cut-out): `python apps/web/scripts/gen-hero.py hero-src.jpg "0.4428,0.4467,0.0438,0.045;0.5727,0.4512,0.0466,0.0442" --cutout --fill=0.88 --center=0.5078`, then paste the printed `lensCenter` into `content/home.ts` |
| home/partner-halo.webp, home/partner-volta.webp | `scripts/gen-partner-art.py <pexels-dir>` | BiRefNet cut-outs of Pexels 3394666 (headphones, backdrop inside the band flooded out) and 34198837 (printed chest patch painted out) |
| home/partner-cleat.webp (+ -depth) | `scripts/gen-partner-art.py <pexels-dir>` | full pair of cleats from Pexels 27299906: BiRefNet cut-out clipped below the collar (ball removed), maker marks diffused away, gilded, on a 16:9 canvas for the depth slide (without the dir it falls back to cleats/cleat-gold, which is cropped at the toe) |
| home/partner-forge.webp | `scripts/gen-partner-art.py` | procedural FORGE packaging (photos r10, career, reel-02) |
| ../textures/light-wash.webp, light-spot.webp, paper-grain.webp | `scripts/gen-lights.py` | soft-light window washes, instant-photo paper grain |
| ../textures/pebble.webp | `scripts/gen-textures.py pebble` | football-leather grain (480px tile): dark rounded pebbles with thin light seams, quantile-matched to the reference's tile statistics; screened on sand (Partnerships), multiplied on dark pages, overlay in the footer |
| ../svg/word-nico.svg, word-valtier.svg, wordmark.svg | `scripts/gen-wordmarks.py` | outlined from Audiowide / Saira (OFL) |
| ../svg/quotes.svg | hand-drawn | quote marks |

The lenses reflect `hero.mp4` (Pexels 5423490), which is also the intro footage and the video behind each signature-moment card.

## Off-Field page

All files under `public/media/off/` are built by `scripts/process-offfield.py <pexels-dir>` (run it as
`python -E` from an empty working directory; cut-outs use rembg 2.0.50 with BiRefNet-general). The
people shots come from one Pexels studio session (photographer *archifashiondesign*), the same model as the
Home hero portrait, so Nico stays one person across the site.

| File(s) | Pexels id(s) | Notes |
|---|---|---|
| off/hero-print.webp | 9573692 | right half (Nico alone), 514:668 print window |
| off/fashion/f01–f09.webp | 9573699, 9573695, 9573702, 9573689, 10220087, 9573693, 9573705, 9573712, 10220084 | fashion rail, native ratios, 1000 px tall |
| off/appear/a01–a04.webp | 39757695, 12153279, 7594122, 30132631 | cropped clear of sponsor boards, club crests, shirt text and a backpack logo |
| off/pieces/p01–p05.webp | 10220082, 10220085, 10220089, 10220086, 10220083 | eyewear cut-outs on a 2:1 canvas (reflections below the table line cropped first), colourways tinted |
| off/footer-portrait.webp | 9573695 | grayscale cut-out on a square canvas, anchored bottom-right (Foundation footer) |
| off/phones/ph01–ph05.mp4 (+ .webp posters) | video 8128031, 9517666, 10349049, 36521302 (9:16 crop), 34631716 | 540×960, 6–7.5 s muted loops |
| off/appear/v01–v04.mp4 (+ .webp posters) | video 6878209, 36521302, 7586489, 39239777 | 1280×720, 6–8 s muted loops; v04 is cropped below the stadium sponsor boards |

Pexels video 34561859 was downloaded but not used (a real college team's end zone and a sponsor logo on the field).
The phone UI over the Digital clips (status bar, tabs, action rail, tab bar) is drawn in SVG by `PhoneMock.astro`.

## Journal page

No new stock: every entry reuses media already listed above, plus art drawn by `scripts/gen-journal.py`
(`python -E apps/web/scripts/gen-journal.py [function …]`; Pillow, numpy, scipy, fontTools + brotli).

| File(s) | Made from | Notes |
|---|---|---|
| journal/huddle.webp (+ -depth) | football.webp | the frame-cut cap is rebuilt from the ball's 180° turn (a ball is point-symmetric), leather darkened, HUDDLE printed along the curve |
| journal/harbor-king-, ember-18-, gold-pe-, halo-, plunge-depth.webp | cleats c07 / c01 / cleat-gold, home/partner-halo, gloves | depth maps from the alpha (multi-radius blur) + a little luminance |
| journal/blur-pe.webp (+ -depth) | home/partner-cleat (+ its depth) | gold pair re-plated in chrome, both cropped together |
| journal/rumble, num-2, num-9, jersey-18, two-star, crest-pa, wolves-plate.webp | Audiowide / Saira (OFL) | die-cut stickers: metallic bevel fills, white backing that follows the silhouette; the plate redraws `crest.svg` |
| journal/arena-99.webp | cards/card-02 | "99 CLUB" and a PIXEL ARENA badge on the card |
| journal/player-, volta-, portrait-, back-sticker.webp | influence-player, home/partner-volta, hero/portrait, footer-player | cut-outs on a sticker backing |
| journal/editorial.webp | off/fashion/f04 | black and white |
| journal/forge-box.webp | home/partner-forge | the front box alone |
| ../textures/paper.webp | procedural | dark paper fibre, screened at 30% over the purple field |

Card stills (entries without a clip) reuse photos listed above, picked free of maker marks and team names.
Entry clips reuse `hero.mp4`, `off/appear/v01–v04.mp4` and `off/phones/ph02–ph05.mp4`.

## Partnerships page

No new stock. `scripts/gen-partnerships.py` (run as `python -E` from an empty cwd; Pillow, numpy, fontTools + brotli)
builds everything under `public/media/partners/` from media listed above plus the site's OFL fonts:

| File(s) | Made from | Notes |
|---|---|---|
| partners/*-key, -camp, -sideline, -tailgate, -session, -field.webp | records, reels, off/appear, off/fashion, influence-field | duotoned campaign posters with the partner's typographic wordmark |
| partners/northline-key, -table, forge-shelf, volta-frames, volta-portrait, halo-studio, arena-card.webp | home/partner-*, cleats, off/pieces, journal/arena-99 | pack shots on a lit sweep / flat lay |
| partners/t/*.webp | every still / poster in `content/partnerships.ts` | 240 px-tall hover-strip thumbnails (`thumbs`) |
| ../textures/light-window.webp, light-tone.webp | procedural (`light`) | soft-light window lights as soft elliptical pools, fitted to the reference's lighting layout: `light-window` is the page wash (.85, under the content; centre darker than the bottom), `light-tone` the DS tone light (BgLayers `.tone-light`, .45 over everything while the body theme is `tone-light`) |

`hero.mp4` is not used here: the socks in it carry a real maker mark.
