/** Partnerships content for the fictional receiver Nico Valtier (#18, Northmark Wolves).
 *  Every partner is invented and shown as a typographic wordmark; copy is invented too.
 *  Stills are Pexels stock already on the site plus art from scripts/gen-partnerships.py
 *  (see MEDIA.md); clips are the site's existing muted loops. */
import { BASE as B } from '@valtier/ds/lib/base';

const m = (p: string) => `${B}/media/${p}`;
/** 240px-tall strip thumbnail built by gen-partnerships.py (`thumbs`). */
export const thumb = (p: string) => `${B}/media/partners/t/${p.replace(/\.(webp|mp4)$/, '').replace(/\//g, '-')}.webp`;

export interface Still { kind: 'image'; src: string; thumb: string; width: number; height: number; alt: string }
export interface Clip { kind: 'video'; src: string; poster: string; thumb: string; width: number; height: number; alt: string }
export type Media = Still | Clip;

export interface Partner {
  id: string;
  name: string;
  category: string;
  description: string;
  /** Lead loop shown first (16:9 cell), like the reference's preview film. */
  lead?: Clip;
  gallery: Media[];
}

const img = (p: string, width: number, height: number, alt: string): Still => ({ kind: 'image', src: m(p), thumb: thumb(p), width, height, alt });
const clip = (p: string, width: number, height: number, alt: string, poster = p.replace(/\.mp4$/, '.webp')): Clip => ({
  kind: 'video', src: m(p), poster: m(poster), thumb: thumb(poster), width, height, alt,
});

export const title = 'Partnerships';

export const partners: Partner[] = [
  {
    id: 'northline',
    name: 'Northline',
    category: 'Footwear',
    description:
      'The signature partnership. Nico is the face of Northline football — custom game-day cleats, design sessions at the Northline lab in Harbor City, and a say in where the footwear goes next.',
    gallery: [
      img('partners/northline-key.webp', 1500, 1000, 'The gold Valtier 18 signature cleat'),
      img('partners/northline-table.webp', 1500, 1000, 'Cleat concepts laid out on the Northline design table'),
      img('off/fashion/f04.webp', 773, 1000, 'Nico between concept rounds at the Northline lab'),
      clip('off/phones/ph02.mp4', 540, 960, 'Northline turf session'),
      img('partners/northline-camp.webp', 800, 1050, 'Built in Harbor City — Northline campaign key art'),
      img('records/r14.webp', 608, 810, 'Breaking in a new pair on the practice field'),
      img('reels/reel-08.webp', 438, 856, 'Helmet in hand after a Northline wear test'),
      img('records/r09.webp', 608, 810, 'Route running in the signature cleat'),
    ],
  },
  {
    id: 'kestrel',
    name: 'Kestrel',
    category: 'Hydration',
    description:
      'Long-running hydration partner, with Kestrel campaigns, sideline science, and a recurring slot in their training-camp rotation.',
    gallery: [
      clip('off/phones/ph05.mp4', 540, 960, 'Kestrel youth camp, between drills'),
      img('partners/kestrel-key.webp', 800, 1050, 'Hydrate like 18 — Kestrel key art'),
      img('reels/reel-06.webp', 438, 856, 'Throwing at the Kestrel camp shoot'),
      img('partners/kestrel-sideline.webp', 800, 1050, 'Kestrel sideline science campaign'),
      img('reels/reel-03.webp', 438, 856, 'Warm-up reps before the Kestrel spot'),
      img('records/r12.webp', 608, 810, 'Game-day pace, Kestrel on the sideline'),
    ],
  },
  {
    id: 'fennick-cola',
    name: 'Fennick Cola',
    category: 'Beverage',
    description:
      'National Fennick campaigns — walking the red carpet for the summer launch and crashing tailgates across the Northmark league.',
    gallery: [
      clip('off/appear/v04.mp4', 1280, 720, 'Fennick Tailgate Crashers spot'),
      img('partners/fennick-key.webp', 1500, 1000, 'Red carpet, ice cold — Fennick Cola key art'),
      img('off/appear/a04.webp', 600, 1000, 'Fennick summer launch, from the crowd'),
      img('partners/fennick-tailgate.webp', 800, 1050, 'Tailgate Crashers poster'),
      img('off/appear/a01.webp', 1465, 1000, 'Fennick halftime show at the Wolves home opener'),
    ],
  },
  {
    id: 'forge',
    name: 'FORGE',
    category: 'Nutrition',
    description:
      'Training-table royalty — a signature FORGE bar with Nico on the box, the limited 18 Pack every season opener, and a recipe series cooked up with the Wolves nutrition staff.',
    gallery: [
      img('partners/forge-shelf.webp', 1500, 1000, 'The FORGE 18 Pack'),
      img('journal/forge-box.webp', 560, 858, 'The signature FORGE box, front'),
      img('career.webp', 938, 1386, 'On set for the FORGE box shoot'),
      img('reels/reel-02.webp', 438, 856, 'The FORGE season-opener spot'),
      img('records/r02.webp', 608, 810, 'Fuelled for the second half'),
    ],
  },
  {
    id: 'volta',
    name: 'VOLTA',
    category: 'Eyewear',
    description: 'Lifestyle and performance eyewear collaboration with VOLTA, from training visors to off-field shades.',
    gallery: [
      img('partners/volta-portrait.webp', 1000, 1250, 'All smiles in the VOLTA Valtier 18 frames'),
      img('off/hero-print.webp', 1028, 1336, 'Portrait in chained VOLTA rounds'),
      img('partners/volta-frames.webp', 1500, 1000, 'The Valtier 18 edition, three colourways'),
      img('off/fashion/f05.webp', 1500, 1000, 'VOLTA rounds on the turf'),
      img('off/fashion/f06.webp', 667, 1000, 'VOLTA launch lookbook'),
      img('off/fashion/f09.webp', 1500, 1000, 'The shield frame, chain on'),
    ],
  },
  {
    id: 'rooster-row',
    name: 'Rooster Row',
    category: 'Brand Ambassador',
    description: 'Brand ambassador for Rooster Row — a recurring face in their game-day and hometown-pride campaigns.',
    gallery: [img('partners/rooster-key.webp', 800, 1050, 'Rooster Row at the Valtier 18 summer camp')],
  },
  {
    id: 'halo-audio',
    name: 'Halo Audio',
    category: 'Audio',
    description:
      'Game-day arrivals run through Halo — pre-game playlists, live studio sessions and the custom white pairs Nico wears through the tunnel.',
    gallery: [
      img('partners/halo-studio.webp', 1000, 1250, 'Halo Studio headphones, 18 edition'),
      img('partners/halo-session.webp', 1500, 1000, 'Pre-game playlist, recorded live'),
      clip('off/appear/v03.mp4', 1280, 720, 'Halo studio session'),
      clip('off/phones/ph04.mp4', 540, 960, 'Halo listening party'),
      img('off/fashion/f08.webp', 773, 1000, 'Halo campaign portrait'),
    ],
  },
  {
    id: 'atlas-co',
    name: 'Atlas & Co',
    category: 'Home Improvement',
    description: 'Part of the Atlas & Co home team — the league’s official home-improvement partner.',
    gallery: [
      img('partners/atlas-key.webp', 1500, 1000, 'Atlas & Co — The Home Team'),
      img('records/r11.webp', 608, 810, 'Nico for the Atlas & Co home team'),
      img('reels/reel-09.webp', 438, 856, 'Atlas & Co spot, ball on the tee'),
    ],
  },
  {
    id: 'meridian-bank',
    name: 'Meridian Bank',
    category: 'Finance',
    description: 'Hometown banking partner — the name over the field Nico lights up on Sundays.',
    gallery: [
      img('partners/meridian-field.webp', 1500, 1000, 'Meridian Bank Field, Northmark'),
      img('records/r04.webp', 608, 810, 'Nico for the Meridian Bank partnership'),
    ],
  },
  {
    id: 'pixel-arena',
    name: 'Pixel Arena',
    category: 'Gaming',
    description: 'A Pixel Arena fixture: repeat member of the 99 Club, the rating reserved for the game’s very best.',
    gallery: [
      clip('off/phones/ph01.mp4', 540, 960, 'Pixel Arena launch-night stream'),
      img('partners/arena-card.webp', 1000, 1250, 'The 99 Club ratings card'),
      img('records/r08.webp', 608, 810, 'Nico in Pixel Arena'),
    ],
  },
  {
    id: 'corner-slice',
    name: 'Corner Slice',
    category: 'Food',
    description: 'National campaign work with the pizza chain, from the “One Day” spot to the game-day promos.',
    gallery: [
      clip('off/phones/ph03.mp4', 540, 960, 'One Day — Corner Slice spot'),
      img('partners/slice-key.webp', 800, 1050, 'Corner Slice game-day key art'),
      img('reels/reel-01.webp', 438, 856, 'Corner Slice game-day promo'),
      img('records/r05.webp', 608, 810, 'Corner Slice on the practice field'),
    ],
  },
  {
    id: 'bravura',
    name: 'Bravura',
    category: 'Fashion',
    description: 'Face of the Fall 26 Bravura League Edit, the league’s fashion collaboration with the house.',
    gallery: [
      img('partners/bravura-key.webp', 800, 1050, 'Nico fronting the Bravura League Edit'),
      img('off/fashion/f01.webp', 1500, 1000, 'On set for the Fall 26 Bravura campaign'),
      img('off/fashion/f03.webp', 1294, 1000, 'Between takes at the Bravura shoot'),
      img('off/fashion/f02.webp', 667, 1000, 'Bravura Fall 26, close-up'),
      img('off/fashion/f07.webp', 1294, 1000, 'The Bravura League Edit cast'),
    ],
  },
  {
    id: 'nocturne',
    name: 'Nocturne',
    category: 'Sleep & Wellness',
    description: 'Recovery starts at night — Nocturne, the league’s official sleep and wellness partner.',
    lead: clip('off/appear/v01.mp4', 1280, 720, 'Night Owl vs. Early Bird — Nocturne episode four'),
    gallery: [
      img('partners/nocturne-key.webp', 1500, 1000, 'Recovery starts at night — Nocturne key art'),
      img('reels/reel-07.webp', 438, 856, 'Rest day, ball down'),
      img('records/r03.webp', 608, 810, 'Nico for Nocturne, the morning after'),
    ],
  },
];

/** Contact cards under "Partner with Nico" (mailto links; the domain is fictional). */
export const inquiry = {
  heading: 'Partner with Nico',
  categories: [
    { label: 'Details', name: 'Partnerships', body: 'Brand partnerships, endorsements, and campaign collaborations.', email: 'partnerships@nicovaltier.example', subject: 'Partnership Inquiry for ' },
    { label: 'Details', name: 'Media & Press', body: 'Interviews, features, and press inquiries.', email: 'media@nicovaltier.example', subject: 'Media Inquiry for ' },
    { label: 'Details', name: 'Booking & Appearances', body: 'Events, appearances, and booking requests.', email: 'booking@nicovaltier.example', subject: 'Booking Inquiry for ' },
  ],
};
