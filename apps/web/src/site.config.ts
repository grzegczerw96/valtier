import type { SiteSettings, FooterCta } from '@valtier/ds/lib/types';
import { BASE as B } from '@valtier/ds/lib/base';

/** Fictional brand: Nico Valtier, #18, wide receiver for the (fictional) Northmark Wolves. */
export const site: SiteSettings = {
  brandName: 'Nico Valtier',
  legalName: 'Nico Valtier',
  navLinks: [
    { label: 'Home', href: B + '/' },
    { label: 'On-Field', href: B + '/on-field' },
    { label: 'Off-Field', href: B + '/off-field' },
    { label: 'Foundation', href: B + '/foundation' },
    { label: 'Partnerships', href: B + '/partnerships' },
    { label: 'Journal', href: B + '/journal' },
    { label: 'Inquiries', href: B + '/inquiries' },
  ],
  socialLinks: [
    { platform: 'instagram', url: 'https://www.instagram.com/' },
    { platform: 'tiktok', url: 'https://www.tiktok.com/' },
    { platform: 'x', url: 'https://x.com/' },
    { platform: 'twitch', url: 'https://www.twitch.tv/' },
  ],
  legalLinks: [
    { label: 'Privacy', href: B + '/privacy' },
    { label: 'Terms', href: B + '/terms' },
  ],
  footerCredit: { label: 'Site by Studio 18', href: '#' },
  studioCredit: { label: 'A Northmark Project', href: '#' },
  partners: [
    { name: 'NORTHLINE', style: 'display', scale: 1.1 },
    { name: 'Kestrel', style: 'serif', scale: 1.15 },
    { name: 'VOLTA', style: 'hero', scale: 0.95 },
    { name: 'atlas & co', style: 'body', scale: 1.05 },
    { name: 'HALO AUDIO', style: 'mono', scale: 1 },
    { name: 'Meridian Bank', style: 'body', scale: 0.95, weight: 600 },
    { name: 'FORGE', style: 'display', scale: 1.25 },
    { name: 'Bravura', style: 'serif', scale: 1.1 },
    { name: 'PIXEL ARENA', style: 'hero', scale: 0.8 },
  ],
};

export const footerVariants: Record<string, FooterCta> = {
  offField: {
    headline: ['The whistle is', 'only the start'],
    phoneHeadline: ['The whistle', 'is only the', 'start'],
    cta: { label: 'Off-Field', href: B + '/off-field' },
    image: { src: B + '/media/footer-player.webp', width: 1200, height: 1200, alt: 'Nico Valtier seen from behind, ball in the air', shift: 0.45 },
  },
  foundation: {
    headline: ['Leave the', 'city better'],
    phoneHeadline: ['Leave the', 'city', 'better'],
    cta: { label: 'Foundation', href: B + '/foundation' },
    image: { src: B + '/media/off/footer-portrait.webp', width: 1200, height: 1200, alt: 'Nico Valtier in chained sunglasses, chin on his hand', shift: 0.45 },
  },
  onField: {
    headline: ['Built for', 'the big stage'],
    phoneHeadline: ['Built', 'for the big', 'stage'],
    cta: { label: 'On-Field', href: B + '/on-field' },
    image: { src: B + '/media/footer-player.webp', width: 1200, height: 1200, alt: 'Nico Valtier', shift: 0.45 },
  },
};

/** The footer trophy opens the latest journal drop (the gold cleat, see content/journal.ts). */
export const trophy = { src: B + '/media/cleats/cleat-gold.webp', href: B + '/journal?item=gold-pe', label: 'Open journal' };

/** Behaviour switches.
 *  firstVisitLoader: like the reference, the first visit of a session opens on the
 *  logo loader (>= 900 ms), then the slanted wipe reveals the page and the hero
 *  powers on. Set to false to skip it (better FCP/LCP/Speed Index). */
export const features = { firstVisitLoader: true };
