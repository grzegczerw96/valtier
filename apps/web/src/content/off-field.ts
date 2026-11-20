/** Off-Field content for the fictional receiver Nico Valtier (#18, Northmark Wolves).
 *  All copy, numbers, shows, networks and brands are invented; logos are typographic
 *  wordmarks. Photos and clips are Pexels stock (see MEDIA.md). */
import { BASE as B } from '@valtier/ds/lib/base';
import type { Partner } from '@valtier/ds/lib/types';

const m = (p: string) => `${B}/media/off/${p}`;

export const hero = {
  title: ['Off', 'Field'],
  intro:
    'Before the catches, before the celebrations, before the city knew his name, there was a kid from the Northmark river flats who understood one thing…',
  print: { src: m('hero-print.webp'), width: 1028, height: 1336, alt: 'Nico Valtier in a black tailored look, adjusting his chained sunglasses' },
};

/** Two lines; accent spans are lavender. */
export const quote: { t: string; accent?: boolean }[][] = [
  [{ t: 'How you arrive ' }, { t: 'speaks', accent: true }],
  [{ t: 'as loud', accent: true }, { t: ' as the game.' }],
];

export const lanes = { fashion: 'Fashion', digital: 'Digital', appearances: 'Appearances', features: 'Features' } as const;
/** Per-title horizontal squeeze so each fitted title keeps the reference's height. */
export const laneSqueeze: Record<keyof typeof lanes, number> = { fashion: 0.87, digital: 0.9, appearances: 0.899, features: 0.915 };

export interface RailPhoto { kind: 'photo'; src: string; width: number; height: number; alt: string; caption?: string }
export interface RailVideo { kind: 'video'; src: string; poster: string; width: number; height: number; alt: string; caption?: string }
export type RailItem = RailPhoto | RailVideo;

/** Typographic stand-ins for third-party logos. */
export interface Wordmark { name: string; style: Partner['style']; scale?: number; tracking?: string; weight?: number; italic?: boolean }

export const fashion = {
  copy: 'From the tunnel walk to the front row, Nico treats every arrival as a statement made before he says a word',
  items: [
    { kind: 'photo', src: m('fashion/f01.webp'), width: 1500, height: 1000, alt: 'Nico Valtier at the centre of a five-piece all-black lineup' },
    { kind: 'photo', src: m('fashion/f02.webp'), width: 667, height: 1000, alt: 'Close-up of Nico Valtier in chained round sunglasses' },
    { kind: 'photo', src: m('fashion/f03.webp'), width: 1294, height: 1000, alt: 'Nico Valtier crouched in front of the crew, black leather and silver hair' },
    { kind: 'photo', src: m('fashion/f04.webp'), width: 773, height: 1000, alt: 'Nico Valtier and a model back to back in black tailoring' },
    { kind: 'photo', src: m('fashion/f05.webp'), width: 1500, height: 1000, alt: 'Signature round frames resting on black stone' },
    { kind: 'photo', src: m('fashion/f06.webp'), width: 667, height: 1000, alt: 'Nico Valtier in a high-collared black coat, looking over his shoulder' },
    { kind: 'photo', src: m('fashion/f07.webp'), width: 1294, height: 1000, alt: 'The crew lined up against a white wall, Nico in the middle' },
    { kind: 'photo', src: m('fashion/f08.webp'), width: 773, height: 1000, alt: 'Nico Valtier seated in front, chin on his hand' },
    { kind: 'photo', src: m('fashion/f09.webp'), width: 1500, height: 1000, alt: 'Filigree side-shield sunglasses on a chain' },
  ] as RailItem[],
  logos: [
    { name: 'HCFW', style: 'serif', scale: 1.15, tracking: '0.04em' },
    { name: 'Orrel', style: 'serif', scale: 1.1, italic: true },
    { name: 'GENT', style: 'display', scale: 1.2, tracking: '0.06em' },
    { name: 'VANTA', style: 'hero', scale: 0.9 },
  ] as Wordmark[],
};

export type GridCard =
  | { type: 'stat'; value: string; label: string; caption: string }
  | { type: 'phone'; video: string; poster: string; alt: string };

const phone = (n: number, alt: string): GridCard => ({ type: 'phone', video: m(`phones/ph0${n}.mp4`), poster: m(`phones/ph0${n}.webp`), alt });

export const digital = {
  copy: 'Streams, short-form clips, podcast seats, viral moments, game-day vlogs. The feed lane — where Nico shows up between kickoffs.',
  /** Five columns (desktop). Phones drop the phones of columns 0 and 4 and one stat. */
  columns: [
    [{ type: 'stat', value: '410K+', label: 'Followers', caption: 'On X' }, phone(1, 'Nico Valtier warming up on the controller before a stream')],
    [{ type: 'stat', value: '1.8M', label: 'Followers', caption: 'On Instagram' }, phone(2, 'A touchdown celebration clip'), { type: 'stat', value: '2X', label: 'Cover Athlete', caption: 'Gridiron 25 · 26' }],
    [phone(3, 'Game face: Nico Valtier before the lights come on'), { type: 'stat', value: '#1', label: 'First in Pixel Arena', caption: 'First pro player in the game — “Wolf Run” emote' }],
    [{ type: 'stat', value: '190K+', label: 'Subscribers', caption: 'On YouTube' }, phone(4, 'Nico Valtier on the Sideline Pod set'), { type: 'stat', value: '62K', label: 'Followers', caption: 'On Twitch' }],
    [phone(5, 'Valtier 18 camp kids huddling on the turf'), { type: 'stat', value: '4.9M+', label: 'Views', caption: 'On YouTube' }],
  ] as GridCard[][],
};

export const appearances = {
  copy: 'Campaign shoots, launch nights, red carpets, talk-show couches, guest slots and cameos. The screen lane — where you meet Nico the personality, helmet off.',
  items: [
    { kind: 'photo', src: m('appear/a01.webp'), width: 1465, height: 1000, alt: 'Flares drifting over the pitch before an exhibition match' },
    { kind: 'video', src: m('appear/v01.mp4'), poster: m('appear/v01.webp'), width: 1280, height: 720, alt: 'Nico Valtier sits down with “The Long Read”' },
    { kind: 'photo', src: m('appear/a02.webp'), width: 773, height: 1000, alt: 'A packed stand, phones up for the walk-out' },
    { kind: 'video', src: m('appear/v02.mp4'), poster: m('appear/v02.webp'), width: 1280, height: 720, alt: 'On the couch at “The Late Huddle”' },
    { kind: 'photo', src: m('appear/a03.webp'), width: 1498, height: 1000, alt: 'Red carpet arrival at the Harbor City premiere' },
    { kind: 'video', src: m('appear/v03.mp4'), poster: m('appear/v03.webp'), width: 1280, height: 720, alt: 'Guest seat on the Sideline Pod' },
    { kind: 'photo', src: m('appear/a04.webp'), width: 600, height: 1000, alt: 'Photographers working the launch night' },
    { kind: 'video', src: m('appear/v04.mp4'), poster: m('appear/v04.webp'), width: 1280, height: 720, alt: 'Fans on their feet at the London exhibition game' },
  ] as RailItem[],
  logos: [
    { name: 'SPORTSCAST', style: 'display', scale: 1.1, tracking: '0.02em' },
    { name: 'NBX', style: 'body', scale: 1.15, weight: 800 },
    { name: 'Daily Post', style: 'serif', scale: 1.05 },
  ] as Wordmark[],
};

export interface FeatureSlide {
  id: string;
  nav: string;
  /** Typographic logo: text, colour, font style. */
  logo: { text: string; color: string; style: Partner['style']; italic?: boolean; scale?: number };
  still: string;
  alt: string;
  caption: string;
  /** Muted preview loop; when set, the slide also offers a play button. */
  loop?: string;
}

export const features: { title: string; slides: FeatureSlide[] } = {
  title: 'Features',
  slides: [
    {
      id: 'second-half', nav: 'Second Half', logo: { text: 'FRAMELINE', color: '#E5383B', style: 'display', scale: 1.1 },
      still: m('appear/v01.webp'), loop: m('appear/v01.mp4'), alt: 'Nico Valtier interviewed for “Second Half”',
      caption: 'One of five receivers followed in “Second Half” — eight episodes on the 2025 season, from camp cuts to playoff nights, streaming on Frameline.',
    },
    {
      id: 'cover-story', nav: 'Sideline Cover', logo: { text: 'SIDELINE', color: '#E24A2B', style: 'hero', italic: true },
      still: m('fashion/f03.webp'), alt: 'The Sideline cover shoot',
      caption: 'Twice a Sideline cover — the 2022 breakout issue, then the 2025 relaunch that restaged a classic double cover with teammate Theo Marsh.',
    },
    {
      id: 'late-huddle', nav: 'The Late Huddle', logo: { text: 'NBX', color: '#F4EFE6', style: 'body', scale: 1.2 },
      still: m('appear/v02.webp'), loop: m('appear/v02.mp4'), alt: 'Nico Valtier on “The Late Huddle”',
      caption: 'A recurring couch on “The Late Huddle” — season previews, a karaoke bit that ran twice, and the night he called his own touchdown.',
    },
    {
      id: 'the-premiere', nav: 'The Premiere', logo: { text: 'Northstream', color: '#7FB7FF', style: 'body', scale: 0.9 },
      still: m('appear/a03.webp'), alt: 'Red carpet at the Harbor City premiere',
      caption: 'A cameo turned supporting part in Northstream’s “Fourth & Long” — red carpet in Harbor City, press day in London.',
    },
    {
      id: 'going-abroad', nav: 'Going Abroad', logo: { text: 'LEAGUE', color: '#9EC3FF', style: 'mono', scale: 1.1 },
      still: m('appear/v04.webp'), loop: m('appear/v04.mp4'), alt: 'Fans at the London exhibition game',
      caption: 'Fronting the league’s “Going Abroad” series in London — an all-access ambassador week as the game builds its European audience.',
    },
    {
      id: 'gent-sport', nav: 'GENT Sport', logo: { text: 'GENT', color: '#F4EFE6', style: 'display', scale: 1.3 },
      still: m('fashion/f01.webp'), alt: 'Nico Valtier in an editorial studio shoot',
      caption: 'A recurring GENT Sport subject — “First Paycheck,” “Ten Essentials,” and the tunnel-fit breakdown that named him the league’s best-dressed.',
    },
    {
      id: 'volta-film', nav: 'VOLTA Film', logo: { text: 'VOLTA', color: '#EEAC1A', style: 'hero', scale: 1 },
      still: m('fashion/f05.webp'), alt: 'The Valtier 18 frames on black stone',
      caption: 'Fronted VOLTA’s “Seen First” film for the co-designed Valtier 18 frames, shot on the river flats where he grew up.',
    },
    {
      id: 'a-season-inside', nav: 'A Season Inside', logo: { text: 'League Films', color: '#C9C2B8', style: 'serif', italic: true },
      still: m('appear/a01.webp'), alt: 'Flares over the pitch',
      caption: '“A Season Inside: Origins” (2024) — League Films on the climb from a two-star recruit to the most productive young receiver of his era.',
    },
    {
      id: 'sideline-pod', nav: 'Sideline Pod', logo: { text: 'HALO', color: '#F4EFE6', style: 'mono', scale: 1.2 },
      still: m('appear/v03.webp'), loop: m('appear/v03.mp4'), alt: 'Guest seat on the Sideline Pod',
      caption: 'A Sideline Pod regular, presented by Halo Audio — wired in for Monday nights and the sideline moments that keep going viral.',
    },
  ],
};

export const pieces = {
  label: 'Seen on the turf',
  items: [
    { src: m('pieces/p01.webp'), title: 'VOLTA Halden — Valtier 18 Series', href: B + '/partnerships' },
    { src: m('pieces/p02.webp'), title: 'VOLTA Shield Violet — Valtier 18 Series', href: B + '/partnerships' },
    { src: m('pieces/p03.webp'), title: 'VOLTA Halden Gold — Valtier 18 Series', href: B + '/partnerships' },
    { src: m('pieces/p04.webp'), title: 'VOLTA Halden Smoke — Valtier 18 Series', href: B + '/partnerships' },
    { src: m('pieces/p05.webp'), title: 'VOLTA Shield Rose — Valtier 18 Series', href: B + '/partnerships' },
  ],
};
