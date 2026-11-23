import type { Cents, Rarity } from '@core/common';

/** Hex colors (#RRGGBB, sRGB) applied to the reusable GLB in core/scene/materials.ts. */
export type BoxTheme = {
  body: string;
  seam: string;
  /** UI accent used for gradients, CTA and glow around the 3D model. */
  accent: string;
  /** Darkest backdrop color for screens that show this box. */
  backdrop: string;
};

export type BoxContent = { watchId: string; weight: number };

/**
 * Bad-luck protection: if the last `within − 1` opens of this box all missed
 * `minRarity`, the next open is rolled only among items of that rarity or better.
 */
export type PityRule = { minRarity: Rarity; within: number };

export type Box = {
  id: string;
  name: string;
  tagline: string;
  priceCents: Cents;
  theme: BoxTheme;
  contents: BoxContent[];
  pity: PityRule;
};

export type WatchImageKey = 'casio' | 'gmt' | 'perpetual' | 'sky-dweller';

export type Watch = {
  id: string;
  brand: string;
  name: string;
  reference: string;
  /** The "server" only knows a key, the client maps it to a bundled image. */
  imageKey: WatchImageKey;
  valueCents: Cents;
  rarity: Rarity;
};
