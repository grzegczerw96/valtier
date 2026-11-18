import type { Platform } from '../components/SocialIcon.astro';

export interface Link { label: string; href: string }
export interface SocialLink { platform: Platform; url: string }

export interface SiteSettings {
  brandName: string;
  legalName: string;
  navLinks: Link[];
  socialLinks: SocialLink[];
  legalLinks: Link[];
  footerCredit: Link;
  studioCredit: Link;
  partners: Partner[];
}

/** Partner marks are rendered as typographic wordmarks (no third-party logos). */
export interface Partner { name: string; style: 'display' | 'body' | 'mono' | 'hero' | 'serif'; scale?: number; tracking?: string; weight?: number }

export interface FooterCta {
  headline: string[];
  phoneHeadline?: string[];
  cta: Link;
  image: { src: string; width: number; height: number; alt: string; shift?: number };
}
