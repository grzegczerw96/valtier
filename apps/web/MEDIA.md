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
| footer-player.webp | 900×1200 | cut-out | Footer portrait |
| crest.svg | vector | logo | Team crest next to "18" |

## Current sources (Pexels licence — free use, modification allowed, no attribution required)

Rebuild everything with `python apps/web/scripts/process-media.py <dir>` where `<dir>/photos/<id>.jpg`
and `<dir>/video/<id>.mp4` are the originals below (cut-outs use rembg 2.0.50, model isnet-general-use).

| Slot | Pexels id(s) |
|---|---|
| hero.mp4, hero-phone.mp4, posters | video 5423490 (first frame = posters) |
| career.webp | 16545258 |
| records r01–r16 | 274577, 39619539, 1476171, 16545262, 263731, 13141525, 159549, 264305, 13141532, 16545275, 35911832, 159662, 13883304, 13141521, 1349531, 32057260 |
| reels 01–09 | 31853532, 34722017, 13141528, 32116679, 31853539, 37234656, 10799811, 13141533, 26707860 |
| influence-field.webp | 36573287 (darkened) |
| influence-player.webp | 159515 (cut-out) |
| footer-player.webp | 39170961 (cut-out) |
| football.webp | 26707860 (cut-out, tee removed) |
| gloves.webp | 13141533 (cut-out: helmet in gloved hand — no receiver-glove shots on Pexels) |
| cleats c01–c10, cleat-gold | 32573999, 32574015, 32574010 (cut-outs + hue-rotated / gilded colourways) |
| hero/portrait (Home) | 9573696 |
| home/partner-halo, home/partner-volta (Home) | 3394666, 34198837 |

Photo URLs: `https://www.pexels.com/photo/<id>/` · video: `https://www.pexels.com/video/<id>/`

## Home page

| File | Made by | Notes |
|---|---|---|
| cards/card-01–05.webp | `scripts/gen-cards.py` | trading cards: rembg cut-out of existing photos (career, r10, reel-02, r16, reel-03) on a violet field, gold dust, bevelled gold frame |
| hero/portrait.webp, portrait-depth.webp, portrait-lens.webp | `scripts/gen-hero.py` | WebGL depth portrait from Pexels 9573696 (top 62% of the frame, BiRefNet cut-out): `python apps/web/scripts/gen-hero.py hero-src.jpg "0.4428,0.4467,0.0438,0.045;0.5727,0.4512,0.0466,0.0442" --cutout --fill=0.88 --center=0.5078`, then paste the printed `lensCenter` into `content/home.ts` |
| home/partner-halo.webp, home/partner-volta.webp | `scripts/gen-partner-art.py <pexels-dir>` | BiRefNet cut-outs of Pexels 3394666 (headphones, backdrop inside the band flooded out) and 34198837 (printed chest patch painted out) |
| home/partner-cleat.webp (+ -depth) | `scripts/gen-partner-art.py` | cleat-gold cut-out on a 16:9 canvas for the depth slide |
| home/partner-forge.webp | `scripts/gen-partner-art.py` | procedural FORGE packaging (photos r10, career, reel-02) |
| ../textures/light-wash.webp, light-spot.webp, paper-grain.webp | `scripts/gen-lights.py` | soft-light window washes, instant-photo paper grain |
| ../svg/word-nico.svg, word-valtier.svg, wordmark.svg | `scripts/gen-wordmarks.py` | outlined from Audiowide / Saira (OFL) |
| ../svg/quotes.svg | hand-drawn | quote marks |

The lenses reflect `hero.mp4` (Pexels 5423490), which is also the intro footage and the video behind each signature-moment card.
