/** On-Field content for the fictional receiver Nico Valtier (#18, Northmark Wolves).
 *  All numbers and copy are invented. Timeline values are cumulative totals at
 *  the START of each labelled year (index 0 = before the rookie season). */

import { BASE as B } from '@valtier/ds/lib/base';

export const hero = {
  title: 'On-Field',
  lines: ['On-', 'Field'],
  number: '18',
  video: { desktop: B + '/media/hero.mp4', phone: B + '/media/hero-phone.mp4' },
  poster: { src: B + '/media/hero-poster.webp', phone: B + '/media/hero-poster-phone.webp', width: 1600, height: 900 },
};

export const quote = [
  [{ t: 'Limits are ' }, { t: 'only there to', accent: true }],
  [{ t: 'be tested.', accent: true }, { t: ' I just keep' }],
  [{ t: 'pushing ' }, { t: 'my own.', accent: true }],
];

export const timeline = {
  years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
  games: [0, 16, 33, 50, 63, 80, 96, 105],
  receptions: [0, 82, 187, 308, 382, 481, 573, 620],
  touchdowns: [0, 8, 19, 28, 34, 46, 51, 55],
  yardsPerGame: [0, 82.6, 87.8, 92.9, 91.2, 90.4, 88.0, 86.0],
};

export const totalYards = { yards: 9034, label: 'Total yards today' };

export const seasons = [
  { year: 2025, team: 'Wolves', receptions: 47, yards: 588, avg: 12.5, long: 41, touchdowns: 4, rushYards: -2, rushAvg: -2.0 },
  { year: 2024, team: 'Wolves', receptions: 92, yards: 1215, avg: 13.2, long: 64, touchdowns: 5, rushYards: 15, rushAvg: 5.0 },
  { year: 2023, team: 'Wolves', receptions: 99, yards: 1486, avg: 15.0, long: 89, touchdowns: 12, rushYards: 9, rushAvg: 1.8 },
  { year: 2022, team: 'Wolves', receptions: 74, yards: 1102, avg: 14.9, long: 55, touchdowns: 6, rushYards: -6, rushAvg: -3.0 },
  { year: 2021, team: 'Wolves', receptions: 121, yards: 1744, avg: 14.4, long: 72, touchdowns: 9, rushYards: 21, rushAvg: 4.2 },
  { year: 2020, team: 'Wolves', receptions: 105, yards: 1577, avg: 15.0, long: 61, touchdowns: 11, rushYards: 12, rushAvg: 3.0 },
  { year: 2019, team: 'Wolves', receptions: 82, yards: 1322, avg: 16.1, long: 68, touchdowns: 8, rushYards: 4, rushAvg: 2.0 },
];

export const career = { heading: 'Pro Career', since: 2019, games: 105, touchdowns: 55, receptions: 620, targets: 912, swipeHint: 'Swipe for full stats →' };

export type Category = 'fastest' | 'youngest' | 'first' | 'only' | 'most';
export const categories: Category[] = ['fastest', 'youngest', 'first', 'only', 'most'];

export const records: { category: Category; value: string; unit: string; short: string; description: string; image: string }[] = [
  { category: 'fastest', value: '41', unit: 'Games', short: 'Fastest ever to\n4,000 receiving yards', description: 'Reached 4,000 career receiving yards in 41 games, the quickest climb the league has ever recorded', image: B + '/media/records/r01.webp' },
  { category: 'fastest', value: '50', unit: 'Games', short: 'Fastest in league\nhistory to 5,000 yards', description: 'Needed only 50 games to pass 5,000 receiving yards, three fewer than the previous mark', image: B + '/media/records/r02.webp' },
  { category: 'fastest', value: '61', unit: 'Games', short: 'Fastest in league\nhistory to 6,000 yards', description: 'Kept the pace and became the fastest player in league history to 6,000 receiving yards', image: B + '/media/records/r03.webp' },
  { category: 'fastest', value: '83', unit: 'Games', short: 'Fastest of the modern\nera to 8,000 yards', description: 'Fastest player of the modern era to 8,000 career receiving yards, in just 83 games', image: B + '/media/records/r04.webp' },
  { category: 'youngest', value: '22', unit: 'Years Old', short: 'Youngest to lead the\nleague in catches and yards', description: 'At 22, the youngest player ever to lead the league in both receptions and receiving yards in one season', image: B + '/media/records/r05.webp' },
  { category: 'youngest', value: '24', unit: 'Years Old', short: 'Youngest ever to\n7,000 receiving yards', description: 'Youngest player in league history to reach 7,000 career receiving yards', image: B + '/media/records/r06.webp' },
  { category: 'youngest', value: '25', unit: 'Years Old', short: 'Youngest ever to\n8,000 receiving yards', description: 'Youngest player in league history to 8,000 receiving yards — more than a season ahead of the old mark', image: B + '/media/records/r07.webp' },
  { category: 'first', value: '1,322', unit: 'Yards', short: 'First rookie in 40 years\npast 1,300 yards', description: 'First rookie in four decades to top 1,300 receiving yards in his debut season (2019)', image: B + '/media/records/r08.webp' },
  { category: 'first', value: '2,899', unit: 'Yards', short: 'First to 2,800 yards in\nhis first two seasons', description: 'First player in league history to clear 2,800 receiving yards across his first two seasons', image: B + '/media/records/r09.webp' },
  { category: 'first', value: '2021', unit: 'Offensive POY', short: 'First Wolves receiver\nnamed Offensive POY', description: 'First wide receiver in franchise history to win Offensive Player of the Year', image: B + '/media/records/r10.webp' },
  { category: 'only', value: '3', unit: 'Seasons', short: 'Only career opened with\nthree 1,300-yard years', description: 'The only player to open a career with three straight 1,300-yard receiving seasons', image: B + '/media/records/r11.webp' },
  { category: 'only', value: '4,643', unit: 'Yards', short: 'Only player with\n4,600+ yards through\nthree seasons', description: 'The only player in league history with more than 4,600 receiving yards through three seasons', image: B + '/media/records/r12.webp' },
  { category: 'only', value: '7,000+', unit: 'Yards', short: 'Only player with 7,000\nyards in five seasons', description: 'The only player in league history with 7,000 receiving yards across his first five seasons', image: B + '/media/records/r13.webp' },
  { category: 'most', value: '308', unit: 'Receptions', short: 'Most receptions ever\nthrough three seasons', description: 'Most receptions in league history through a player’s first three seasons', image: B + '/media/records/r14.webp' },
  { category: 'most', value: '8,446', unit: 'Yards', short: 'Most receiving yards\never through six seasons', description: 'Most receiving yards in league history through a player’s first six seasons', image: B + '/media/records/r15.webp' },
  { category: 'most', value: '86.0', unit: 'Yards/Game', short: 'Career receiving\nyards per game', description: 'Averaging 86 receiving yards per game across his entire regular-season career', image: B + '/media/records/r16.webp' },
];

export const influence = {
  top: 'The anatomy of',
  word: 'Influence',
  field: { src: B + '/media/influence-field.webp', width: 1440, height: 1078, alt: 'Football resting on a yard line' },
  cutout: { src: B + '/media/influence-player.webp', width: 660, height: 900, alt: 'Nico Valtier breaking upfield with the ball' },
};

export const cleats = {
  items: [
    { src: B + '/media/cleats/c01.webp', title: 'Crimson Studs' },
    { src: B + '/media/cleats/c02.webp', title: 'Night Shift' },
    { src: B + '/media/cleats/c03.webp', title: 'Ultraviolet' },
    { src: B + '/media/cleats/c04.webp', title: 'Chrome Day' },
    { src: B + '/media/cleats/c05.webp', title: 'Silver Lining' },
    { src: B + '/media/cleats/c06.webp', title: 'Quilted White' },
    { src: B + '/media/cleats/c07.webp', title: 'Gold Standard' },
    { src: B + '/media/cleats/c08.webp', title: 'Arcade' },
    { src: B + '/media/cleats/c09.webp', title: 'Number 18' },
    { src: B + '/media/cleats/c10.webp', title: 'Monogram' },
  ],
  phrases: [
    'Style is part of the play',
    'I want every pair to tell a story',
    'One of one',
    'The details are where it starts',
    'Dress for the moment',
    'A look is more than the clothes',
    'Made for Sundays',
  ],
};

export const pace = {
  heading: 'Keeping the Pace',
  reels: Array.from({ length: 9 }, (_, i) => ({
    id: `reel-${i + 1}`,
    platform: (i % 3 === 0 ? 'tiktok' : 'instagram') as 'tiktok' | 'instagram',
    url: i % 3 === 0 ? 'https://www.tiktok.com/' : 'https://www.instagram.com/',
    thumb: `${B}/media/reels/reel-${String(i + 1).padStart(2, '0')}.webp`,
    video: undefined as string | undefined,
  })),
};

export const statsLabels = [
  { key: 'games', label: 'Games' },
  { key: 'receptions', label: 'Receptions' },
  { key: 'touchdowns', label: 'Total TDs' },
  { key: 'yardsPerGame', label: 'Yds / Game', decimals: 1 },
] as const;

export const flyers = {
  football: { src: B + '/media/football.webp', width: 600, height: 377 },
  gloves: { src: B + '/media/gloves.webp', width: 1079, height: 1071 },
};

export const badge = { src: B + '/media/crest.svg', width: 122, height: 122, alt: 'Northmark Wolves crest' };
