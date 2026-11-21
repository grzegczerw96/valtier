/** Journal content for the fictional receiver Nico Valtier (#18, Northmark Wolves).
 *  Every story, outlet, show, brand and number is invented. Art comes from the site's
 *  own media (Pexels stock, see MEDIA.md) and the stickers drawn by scripts/gen-journal.py.
 *
 *  Field coordinates are in the reference's design units: one tile of the infinite
 *  field is 3900 x 6160 with a shear of (975, 880); x/y are item centres in that tile,
 *  width/height the item box at a 1440 x 900 viewport. */
import { BASE as B } from '@valtier/ds/lib/base';

const m = (p: string) => `${B}/media/${p}`;

export type JournalKind = 'video' | 'link' | 'shop' | 'post';
export interface JournalDetail { label: string; value: string }
export interface JournalItem {
  id: string;
  src: string;
  alt: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  frame: 'bare' | 'polaroid';
  /** Light sweep that follows the pointer while the item is lifted. */
  sheen: boolean;
  /** Corner radius in % of the item width. */
  radius?: number;
  /** WebGL depth slide (pointer parallax) on desktop. */
  depth?: { src: string; map: string };
  label: string;
  brand: string;
  category: string;
  body?: string;
  kind: JournalKind;
  cta?: string;
  link?: string;
  video?: { src: string; poster: string };
  details: JournalDetail[];
}

export const field = { tileW: 3900, tileH: 6160, shearX: 975, shearY: 880 };
export const copy = { title: 'Journal', hint: 'Drag · scroll · click', hintMobile: 'Swipe · tap' };

const ext = (channel: string, category: string): JournalDetail[] => [
  { label: 'Channel', value: channel },
  { label: 'Category', value: category },
  { label: 'Source', value: 'External' },
];
const clip = (src: string, poster: string) => ({ src: m(src), poster: m(poster) });

export const items: JournalItem[] = [
  {
    id: 'huddle-cover', src: m('journal/huddle.webp'), alt: 'Black leather football printed with HUDDLE',
    depth: { src: m('journal/huddle.webp'), map: m('journal/huddle-depth.webp') },
    x: 0, y: 0, width: 452, height: 371, rotation: -5.1, frame: 'bare', sheen: false,
    label: 'Nico Valtier on Why Route Running Is a Language', brand: 'The Huddle', category: 'Feature',
    body: 'A conversation with Mara Quinn for The Huddle’s autumn cover story. Nico talks timing, trust, and the veterans who taught him to read a defence before the snap.',
    kind: 'video', video: clip('off/appear/v02.mp4', 'off/appear/v02.webp'), details: ext('The Huddle', 'Feature'),
  },
  {
    id: 'poy-award', src: m('cards/card-03.webp'), alt: 'Gold-framed card of a receiver cradling the ball',
    x: 780.06, y: 73.25, width: 423, height: 620, rotation: -4.3, frame: 'bare', sheen: true,
    label: 'Nico Valtier Wins Offensive Player of the Year | League Honors', brand: 'Northmark League', category: 'Big Moment',
    kind: 'video', video: clip('hero.mp4', 'hero-poster.webp'), details: ext('Northmark League', 'Big Moment'),
  },
  {
    id: 'rumble-night', src: m('journal/rumble.webp'), alt: 'Gold RUMBLE NIGHT sticker',
    x: 1561.72, y: -8.24, width: 532, height: 190, rotation: 5.8, frame: 'bare', sheen: true,
    label: 'I Went Ringside at Rumble Night', brand: 'Nico Valtier', category: 'Collaboration',
    kind: 'video', video: clip('off/appear/v04.mp4', 'off/appear/v04.webp'), details: ext('Nico Valtier', 'Collaboration'),
  },
  {
    id: 'harbor-king', src: m('cleats/c07.webp'), alt: 'Black and gold cleat',
    depth: { src: m('cleats/c07.webp'), map: m('journal/harbor-king-depth.webp') },
    x: -1550.67, y: -800.92, width: 436, height: 390, rotation: -5.6, frame: 'bare', sheen: false,
    label: 'Harbor King', brand: 'Northline', category: 'Feature',
    body: 'Coastline Weekly traces the cleats, the camp, and the style back to the Port Alder docks.',
    kind: 'link', cta: 'Read the feature', link: B + '/off-field',
    details: ext('Northline', 'Feature'),
  },
  {
    id: 'halo-studio', src: m('home/partner-halo.webp'), alt: 'Bone-white studio headphones',
    depth: { src: m('home/partner-halo.webp'), map: m('journal/halo-depth.webp') },
    x: -763.69, y: -871.84, width: 460, height: 474, rotation: -4.5, frame: 'bare', sheen: true,
    label: 'The Halo Studio Cans', brand: 'Halo Audio', category: 'Style',
    body: 'The headphones from Nico’s game-day walk-in, finished in bone white by Halo Audio, with an 18 stitched into each band.',
    kind: 'link', cta: 'Learn more', link: B + '/off-field',
    details: [{ label: 'Partner', value: 'Halo Audio' }, { label: 'Piece', value: 'Studio headphones' }, { label: 'Finish', value: 'Bone white, gold 18' }],
  },
  {
    id: 'forge-fuel', src: m('home/partner-forge.webp'), alt: 'Three FORGE boxes with Nico Valtier on the front',
    x: -50.13, y: -807.6, width: 508, height: 329, rotation: -3.4, frame: 'bare', sheen: false,
    label: 'Forge 18 Fuel', brand: 'Forge', category: 'Collaboration',
    body: 'His own Forge box: oat clusters and honey crunch in a purple-and-gold run, back on shelves for training camp.',
    kind: 'link', cta: 'Learn more', link: B + '/',
    details: [{ label: 'Partner', value: 'Forge' }, { label: 'Piece', value: 'Limited box' }, { label: 'Flavor', value: 'Honey crunch' }],
  },
  {
    id: 'arena-99', src: m('journal/arena-99.webp'), alt: 'Pixel Arena 99 Club card',
    x: 691.58, y: -886.67, width: 416, height: 609, rotation: 2.5, frame: 'bare', sheen: true,
    label: 'Pixel Arena 99 Club', brand: 'Pixel Arena', category: 'Digital',
    body: 'Three straight years rated 99 overall in Pixel Arena 24, 25 and 26. The 99 Club is video game royalty, and Nico keeps renewing his membership.',
    kind: 'shop',
    details: [{ label: 'Rating', value: '99 overall' }, { label: 'Editions', value: 'Pixel Arena 24 · 25 · 26' }, { label: 'Publisher', value: 'Pixel Arena' }],
  },
  {
    id: 'ember-18', src: m('cleats/c01.webp'), alt: 'Black and red cleat',
    depth: { src: m('cleats/c01.webp'), map: m('journal/ember-18-depth.webp') },
    x: 1491.4, y: -806.77, width: 404, height: 361, rotation: 3.6, frame: 'bare', sheen: true,
    label: 'Northline x Valtier PE: Ember 18', brand: 'Northline', category: 'Footwear',
    body: 'Made to be seen from the upper deck. Inspired by his first car, Ember 18 is a red-on-black player exclusive cut for the Wolves’ night games.',
    kind: 'shop',
    details: [{ label: 'Colorway', value: 'Ember red' }, { label: 'Edition', value: 'Player Exclusive' }, { label: 'Category', value: 'Footwear' }],
  },
  {
    id: 'milan-menswear', src: m('off/fashion/f02.webp'), alt: 'Nico Valtier in chained round sunglasses',
    x: -1666.72, y: -1767.62, width: 368, height: 552, rotation: 6.6, frame: 'polaroid', sheen: true,
    label: '2025 Milan Menswear', brand: 'Atlas & Co', category: 'Fashion',
    body: 'Nico in an all-black Atlas & Co look, front row for the label’s Spring/Summer 2025 menswear show.',
    kind: 'shop',
    details: [{ label: 'Designer', value: 'Atlas & Co' }, { label: 'Show', value: 'Menswear SS25' }, { label: 'Look', value: 'All-black tailoring' }],
  },
  {
    id: 'gala-arrival', src: m('off/appear/a03.webp'), alt: 'Two guests stepping onto a red carpet',
    x: -911.44, y: -1698.86, width: 467, height: 312, rotation: 5.1, frame: 'polaroid', sheen: true,
    label: 'Harbor Gala Arrival', brand: 'Bravura', category: 'Off-Field',
    body: 'The Wolves’ season-opening gala on the Port Alder waterfront, with Bravura dressing the whole receiver room for the carpet.',
    kind: 'shop',
    details: [{ label: 'Dressed by', value: 'Bravura' }, { label: 'Venue', value: 'Port Alder Waterfront' }, { label: 'Format', value: 'Season gala' }],
  },
  {
    id: 'kestrel-editorial', src: m('journal/editorial.webp'), alt: 'Black and white studio portrait, back to back',
    x: -147.79, y: -1762.11, width: 338, height: 437, rotation: 4.9, frame: 'polaroid', sheen: true,
    label: 'Kestrel Editorial', brand: 'Kestrel', category: 'Campaign',
    body: 'Black and white, chain up, shades on. A studio frame from the Kestrel shoot.',
    kind: 'shop',
    details: [{ label: 'Partner', value: 'Kestrel' }, { label: 'Format', value: 'Studio editorial' }, { label: 'Finish', value: 'Black & white' }],
  },
  {
    id: 'mvp-card', src: m('cards/card-05.webp'), alt: 'Holographic MVP trading card',
    x: 589.92, y: -1690.18, width: 388, height: 569, rotation: -2.5, frame: 'bare', sheen: true,
    label: 'The MVP Card', brand: 'Collectible', category: 'Cards',
    body: 'Posted by @nicovaltier on December 22, 2025.',
    kind: 'link', cta: 'View on Instagram', link: 'https://www.instagram.com/',
    details: [{ label: 'Year', value: '2024' }, { label: 'Finish', value: 'Holographic' }, { label: 'Format', value: 'Trading card' }],
  },
  {
    id: 'kestrel-stunt', src: m('off/pieces/p02.webp'), alt: 'Violet shield sunglasses on a chain',
    x: 1437.86, y: -1761.21, width: 596, height: 298, rotation: 2.8, frame: 'bare', sheen: true,
    label: 'Kestrel Stunt Collection', brand: 'Kestrel', category: 'Eyewear',
    body: 'Nico in two performance-driven styles, the Stunt Wing and the Stunt Glider, built for glare off a white sideline.',
    kind: 'shop',
    details: [{ label: 'Styles', value: 'Stunt Wing · Stunt Glider' }, { label: 'Category', value: 'Eyewear' }],
  },
  {
    id: 'kestrel-shoot', src: m('off/fashion/f08.webp'), alt: 'Nico Valtier seated with the crew in front of a white wall',
    x: -1647.37, y: -2555.65, width: 333, height: 431, rotation: -6.4, frame: 'polaroid', sheen: true,
    label: 'On Set with Kestrel', brand: 'Kestrel', category: 'Campaign',
    body: 'On set with Kestrel, shooting the signature eyewear series that carries Nico’s name.',
    kind: 'shop',
    details: [{ label: 'Partner', value: 'Kestrel' }, { label: 'Line', value: 'NV18 Signature Series' }, { label: 'Format', value: 'Photoshoot' }],
  },
  {
    id: 'gold-pe', src: m('cleats/cleat-gold.webp'), alt: 'Gold cleat',
    depth: { src: m('cleats/cleat-gold.webp'), map: m('journal/gold-pe-depth.webp') },
    x: -879.93, y: -2630.99, width: 450, height: 402, rotation: -3.5, frame: 'bare', sheen: true,
    label: 'Ninety-Nine PE', brand: 'Northline', category: 'Footwear',
    body: 'Gold-plated Northline cleats that celebrate his 99 overall in Pixel Arena, worn for one night only in the Wolves’ home opener.',
    kind: 'shop',
    details: [{ label: 'Colorway', value: 'Gold' }, { label: 'Edition', value: 'Player Exclusive' }, { label: 'Category', value: 'Footwear' }],
  },
  {
    id: 'cover-story', src: m('off/fashion/f05.webp'), alt: 'Round sunglasses resting on black stone',
    x: -114.36, y: -2561.74, width: 395, height: 263, rotation: -3, frame: 'polaroid', sheen: true,
    label: 'Gridiron Weekly Cover Story', brand: 'Gridiron Weekly', category: 'Feature',
    body: 'Gridiron Weekly’s cover story from 2022: Nico on his career so far, his family, and the river town that raised him.',
    kind: 'shop',
    details: [{ label: 'Outlet', value: 'Gridiron Weekly' }, { label: 'Year', value: '2022' }, { label: 'Format', value: 'Cover story' }],
  },
  {
    id: 'stadium-walk', src: m('off/appear/a02.webp'), alt: 'Looking over a packed stand from the concourse',
    x: 579.46, y: -2636.75, width: 313, height: 405, rotation: 6.5, frame: 'polaroid', sheen: true,
    label: 'Concourse Walk', brand: 'Bravura', category: 'Fashion',
    body: 'Nico and former college teammate Theo Hart, dressed to impress on the walk up to the Bravura SS25 show.',
    kind: 'shop',
    details: [{ label: 'Event', value: 'Bravura SS25 Men’s Show' }, { label: 'Location', value: 'Milan Fashion Week' }, { label: 'With', value: 'Theo Hart' }],
  },
  {
    id: 'bowl-card', src: m('cards/card-04.webp'), alt: 'Gold-framed card of a player in a white helmet',
    x: 1236.42, y: -2564.23, width: 279, height: 409, rotation: -4.8, frame: 'bare', sheen: true,
    label: 'Port Alder Harbor Bowl', brand: 'Collectible', category: 'Cards',
    body: 'A nod to the night at Port Alder when Nico put four first-half touchdowns on the board in the Harbor Bowl.',
    kind: 'shop',
    details: [{ label: 'Year', value: '2020' }, { label: 'Moment', value: 'The Harbor Bowl' }, { label: 'Format', value: 'Trading card' }],
  },
  {
    id: 'blur-pe', src: m('journal/blur-pe.webp'), alt: 'Chrome pair of cleats',
    depth: { src: m('journal/blur-pe.webp'), map: m('journal/blur-pe-depth.webp') },
    x: -971.33, y: 2629.09, width: 330, height: 299, rotation: -5, frame: 'bare', sheen: true,
    label: 'Northline Blur PE: The Shine', brand: 'Northline', category: 'Footwear',
    body: 'Record-breaking numbers, unbothered shine. Nico does it all, and so do his cleats.',
    kind: 'shop',
    details: [{ label: 'Colorway', value: 'Chrome' }, { label: 'Released', value: '2025' }, { label: 'Category', value: 'Footwear' }],
  },
  {
    id: 'catch-of-the-year', src: m('off/phones/ph02.webp'), alt: 'Player on his knees in celebration',
    x: -237.44, y: 2725.14, width: 279, height: 496, rotation: 5.9, frame: 'bare', sheen: true, radius: 2,
    label: 'Nico Valtier Catch of the Year', brand: 'Northmark League', category: 'Big Moment',
    body: 'One hand, fourth down, overtime on the line. League Films on the catch of the year.',
    kind: 'video', video: clip('off/phones/ph02.mp4', 'off/phones/ph02.webp'), details: ext('Northmark League', 'Big Moment'),
  },
  {
    id: 'top-100-2025', src: m('journal/num-9.webp'), alt: 'Gold #9 sticker',
    x: 521.7, y: 2637.35, width: 597, height: 325, rotation: 3.6, frame: 'bare', sheen: true,
    label: 'Nico Valtier (WR, Wolves) | Top 100 Players of 2025', brand: 'Northmark League', category: 'News',
    body: 'Voted the league’s No. 9 player by his peers heading into the 2025 season.',
    kind: 'post', cta: 'See the numbers', link: B + '/on-field',
    details: [{ label: 'Channel', value: 'Northmark League' }, { label: 'Category', value: 'News' }, { label: 'Source', value: 'Journal' }],
  },
  {
    id: 'celebration-fan', src: m('journal/player-sticker.webp'), alt: 'Sticker of a receiver running with the ball',
    x: 1337.86, y: 2707.41, width: 422, height: 556, rotation: 5.5, frame: 'bare', sheen: false,
    label: 'When you meet Nico Valtier and all you want to do is celebrate', brand: 'Northmark Wolves', category: 'News',
    body: 'A young fan meets Nico, and there’s only one way to mark it.',
    kind: 'video', video: clip('off/appear/v04.mp4', 'off/appear/v04.webp'), details: ext('Northmark Wolves', 'News'),
  },
  {
    id: 'cold-open', src: m('gloves.webp'), alt: 'Helmet held in a gloved hand',
    depth: { src: m('gloves.webp'), map: m('journal/plunge-depth.webp') },
    x: -1741.66, y: 1763.61, width: 488, height: 484, rotation: -2.6, frame: 'bare', sheen: false,
    label: 'Nico Valtier Takes the Plunge with Dex Moreno | Cold Open', brand: 'Laugh Track', category: 'Collaboration',
    body: 'Ice tubs and one-liners with Dex Moreno on Cold Open.',
    kind: 'video', video: clip('off/appear/v01.mp4', 'off/appear/v01.webp'), details: ext('Laugh Track', 'Collaboration'),
  },
  {
    id: 'volta-spot', src: m('journal/volta-sticker.webp'), alt: 'Sticker of a man in sunglasses looking up',
    x: -937.87, y: 1840.29, width: 380, height: 481, rotation: -3.3, frame: 'bare', sheen: true,
    label: 'Nico Valtier & Theo Hart Volta Commercial (2025)', brand: 'Volta', category: 'Collaboration',
    body: 'College teammates reunited: Nico and Theo Hart for Volta.',
    kind: 'video', video: clip('off/phones/ph03.mp4', 'off/phones/ph03.webp'), details: ext('Volta', 'Collaboration'),
  },
  {
    id: 'highlights-30', src: m('journal/jersey-18.webp'), alt: 'Purple and gold 18 jersey-number sticker',
    x: -122.98, y: 1757.67, width: 426, height: 517, rotation: 3, frame: 'bare', sheen: true,
    label: '30 Minutes of Nico Valtier Highlights', brand: 'Northmark League', category: 'Big Moment',
    body: 'Thirty minutes of route running, one-handers, and end-zone dances.',
    kind: 'video', video: clip('hero.mp4', 'hero-poster.webp'), details: ext('Northmark League', 'Big Moment'),
  },
  {
    id: 'youth-camp', src: m('records/r13.webp'), alt: 'Two young players kneeling on the turf',
    x: 640.63, y: 1828.5, width: 300, height: 400, rotation: -4.8, frame: 'bare', sheen: true,
    label: 'Nico Valtier hosts youth football camp back home on the river flats', brand: 'River Flats 6', category: 'Collaboration',
    body: 'Back home on the Northmark river flats, Nico runs his youth camp at his old high school field.',
    kind: 'video', video: clip('off/phones/ph05.mp4', 'off/phones/ph05.webp'), details: ext('River Flats 6', 'Collaboration'),
  },
  {
    id: 'one-camp', src: m('journal/crest-pa.webp'), alt: 'Port Alder college crest sticker',
    x: 1440.44, y: 1755.82, width: 484, height: 343, rotation: 6.1, frame: 'bare', sheen: false,
    label: 'Nico Valtier wasn’t on Port Alder’s radar… then one prospect camp changed everything', brand: 'Next Big Deal', category: 'News',
    body: 'The prospect camp that put Nico on Port Alder’s radar and changed everything.',
    kind: 'video', video: clip('off/appear/v03.mp4', 'off/appear/v03.webp'), details: ext('Next Big Deal', 'News'),
  },
  {
    id: 'more-than-sundays', src: m('journal/wolves-plate.webp'), alt: 'Northmark Wolves plate sticker',
    x: -1638.51, y: 941.89, width: 465, height: 233, rotation: -5.5, frame: 'bare', sheen: false,
    label: 'Nico Valtier: It’s more to me than catching footballs on Sundays', brand: 'Northmark Wolves', category: 'News',
    body: 'On family, community, and why the work off the field matters as much as the catches.',
    kind: 'video', video: clip('off/appear/v01.mp4', 'off/appear/v01.webp'), details: ext('Northmark Wolves', 'News'),
  },
  {
    id: 'off-the-clock', src: m('journal/portrait-sticker.webp'), alt: 'Sticker of Nico Valtier in round sunglasses',
    x: -827.97, y: 871.9, width: 454, height: 499, rotation: -4.5, frame: 'bare', sheen: true,
    label: 'We Spent the Day with Nico Valtier | Off the Clock', brand: 'Fitcheck', category: 'Collaboration',
    body: 'A day off the clock: cars, fits, and film with Fitcheck.',
    kind: 'video', video: clip('off/phones/ph04.mp4', 'off/phones/ph04.webp'), details: ext('Fitcheck', 'Collaboration'),
  },
  {
    id: 'micd-up', src: m('off/appear/a01.webp'), alt: 'Smoke drifting over a packed stand',
    x: -31.73, y: 950.05, width: 421, height: 287, rotation: -5.1, frame: 'polaroid', sheen: true,
    label: 'Nico Valtier Mic’d Up at the Invite-Only Receiver Camp! “This Ain’t Friendly”', brand: 'Overtime Lane', category: 'Collaboration',
    body: 'Mic’d up and talking his talk at the invite-only receiver camp.',
    kind: 'video', video: clip('off/phones/ph02.mp4', 'off/phones/ph02.webp'), details: ext('Overtime Lane', 'Collaboration'),
  },
  {
    id: 'two-star', src: m('journal/two-star.webp'), alt: 'Two-star recruit badge sticker',
    x: 753.1, y: 878.52, width: 435, height: 435, rotation: 4.4, frame: 'bare', sheen: false,
    label: 'How a Two-Star Recruit Became a League Superstar', brand: 'Nonstop', category: 'News',
    body: 'From two-star recruit to the top of the receiver game.',
    kind: 'video', video: clip('off/appear/v03.mp4', 'off/appear/v03.webp'), details: ext('Nonstop', 'News'),
  },
  {
    id: 'top-100-2023', src: m('journal/num-2.webp'), alt: 'Gold #2 sticker',
    x: 1566.04, y: 941.22, width: 532, height: 297, rotation: 6.6, frame: 'bare', sheen: true,
    label: '#2 Nico Valtier (WR, Wolves) | Top 100 Players of 2023', brand: 'Northmark League', category: 'Big Moment',
    body: 'Peers ranked Nico the No. 2 player in football after his 126-catch, 1,812-yard 2022 season.',
    kind: 'video', video: clip('hero.mp4', 'hero-poster.webp'), details: ext('Northmark League', 'Big Moment'),
  },
  {
    id: 'first-touchdown', src: m('journal/back-sticker.webp'), alt: 'Sticker of number 7 seen from behind',
    x: -1499.94, y: -10.14, width: 248, height: 600, rotation: -3.1, frame: 'bare', sheen: true,
    label: 'Nico Valtier’s Unforgettable First Touchdown', brand: 'Replay Room', category: 'Big Moment',
    body: 'The first one. Rookie year, and the start of everything.',
    kind: 'video', video: clip('off/phones/ph02.mp4', 'off/phones/ph02.webp'), details: ext('Replay Room', 'Big Moment'),
  },
  {
    id: 'receiver-camp', src: m('cards/card-01.webp'), alt: 'Gold-framed card of two players in purple and white',
    x: -762.95, y: 73.64, width: 326, height: 477, rotation: 2.7, frame: 'bare', sheen: false,
    label: 'Nico Valtier’s Secret Receiver Camp for Five-Stars', brand: 'Overtime Lane', category: 'Collaboration',
    body: 'Nico runs routes with the next generation of five-star receivers.',
    kind: 'video', video: clip('off/phones/ph05.mp4', 'off/phones/ph05.webp'), details: ext('Overtime Lane', 'Collaboration'),
  },
];

/** The entry the footer trophy opens (the gold cleat, like the reference's latest drop). */
export const latestId = 'gold-pe';
