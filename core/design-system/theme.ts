import type { Rarity } from '@core/common';

export const colors = {
  background: '#09090b',
  surface: '#131317',
  surfaceRaised: '#1b1b21',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#f5f3ee',
  textMuted: '#a1a1aa',
  textFaint: '#6b6b74',
  gold: '#e8c27a',
  goldDeep: '#b8913f',
  onGold: '#1a1306',
  success: '#4ade80',
  danger: '#f87171',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

export const rarityColors: Record<Rarity, string> = {
  common: '#aab3c2',
  rare: '#4fa3ff',
  epic: '#b36bff',
  legendary: '#f5b83d',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.6 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  mono: { fontSize: 15, lineHeight: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Mixes a hex color with alpha, e.g. withAlpha('#ff0000', 0.3). */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}
