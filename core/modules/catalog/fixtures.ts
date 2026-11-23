import { dollars } from '@core/common';
import type { Box, Watch } from './types';

/**
 * Seed data owned by the mock server. Prices are roughly the expected value of
 * the box so that the odds shown in the UI are honest.
 */
export const WATCHES: Watch[] = [
  {
    id: 'w_casio',
    brand: 'Casio',
    name: 'Vintage Digital',
    reference: 'A168WA-1',
    imageKey: 'casio',
    valueCents: dollars(65),
    rarity: 'common',
  },
  {
    id: 'w_perpetual',
    brand: 'Rolex',
    name: 'Oyster Perpetual',
    reference: '124300',
    imageKey: 'perpetual',
    valueCents: dollars(6_500),
    rarity: 'rare',
  },
  {
    id: 'w_gmt',
    brand: 'Rolex',
    name: 'GMT-Master II',
    reference: '126710BLRO',
    imageKey: 'gmt',
    valueCents: dollars(11_000),
    rarity: 'epic',
  },
  {
    id: 'w_sky',
    brand: 'Rolex',
    name: 'Sky-Dweller',
    reference: '336934',
    imageKey: 'sky-dweller',
    valueCents: dollars(18_500),
    rarity: 'legendary',
  },
];

export const BOXES: Box[] = [
  {
    id: 'b_icy',
    name: 'Icy Starter',
    tagline: 'The original. Small price, real chance.',
    priceCents: dollars(149),
    theme: { body: '#26282c', seam: '#8fd3e8', accent: '#7cc8e0', backdrop: '#0b1217' },
    pity: { minRarity: 'rare', within: 60 },
    contents: [
      { watchId: 'w_casio', weight: 99_000 },
      { watchId: 'w_perpetual', weight: 700 },
      { watchId: 'w_gmt', weight: 230 },
      { watchId: 'w_sky', weight: 70 },
    ],
  },
  {
    id: 'b_midnight',
    name: 'Midnight',
    tagline: 'Deep blue, one in ten hits steel.',
    priceCents: dollars(899),
    theme: { body: '#1b2440', seam: '#d9b26b', accent: '#5b7cff', backdrop: '#070a17' },
    pity: { minRarity: 'rare', within: 15 },
    contents: [
      { watchId: 'w_casio', weight: 90_000 },
      { watchId: 'w_perpetual', weight: 7_000 },
      { watchId: 'w_gmt', weight: 2_200 },
      { watchId: 'w_sky', weight: 800 },
    ],
  },
  {
    id: 'b_emerald',
    name: 'Emerald',
    tagline: 'Two in five land a crown.',
    priceCents: dollars(3_599),
    theme: { body: '#0f3b2e', seam: '#e3c48a', accent: '#2fbf8a', backdrop: '#04130e' },
    pity: { minRarity: 'epic', within: 10 },
    contents: [
      { watchId: 'w_casio', weight: 60_000 },
      { watchId: 'w_perpetual', weight: 25_000 },
      { watchId: 'w_gmt', weight: 11_000 },
      { watchId: 'w_sky', weight: 4_000 },
    ],
  },
  {
    id: 'b_reserve',
    name: 'Gold Reserve',
    tagline: 'No quartz. Every box is a crown.',
    priceCents: dollars(9_499),
    theme: { body: '#3a2a12', seam: '#f4d27a', accent: '#f0b93a', backdrop: '#140d03' },
    pity: { minRarity: 'legendary', within: 12 },
    contents: [
      { watchId: 'w_perpetual', weight: 55_000 },
      { watchId: 'w_gmt', weight: 33_000 },
      { watchId: 'w_sky', weight: 12_000 },
    ],
  },
];
