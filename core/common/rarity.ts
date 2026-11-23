export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY_ORDER: Record<Rarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

export function compareRarityDesc(a: Rarity, b: Rarity): number {
  return RARITY_ORDER[b] - RARITY_ORDER[a];
}

export function rarityAtLeast(rarity: Rarity, min: Rarity): boolean {
  return RARITY_ORDER[rarity] >= RARITY_ORDER[min];
}
