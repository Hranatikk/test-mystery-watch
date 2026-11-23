import type { Rng } from './random';

export type Weighted<T> = { item: T; weight: number };

/**
 * Picks one item proportionally to its weight.
 * Items with weight <= 0 are never picked.
 */
export function weightedPick<T>(entries: readonly Weighted<T>[], rng: Rng): T {
  const total = totalWeight(entries);
  if (total <= 0) {
    throw new Error('weightedPick: total weight must be positive');
  }
  let roll = rng() * total;
  for (const entry of entries) {
    if (entry.weight <= 0) {
      continue;
    }
    roll -= entry.weight;
    if (roll < 0) {
      return entry.item;
    }
  }
  // Floating point safety net: return the last positive-weight entry.
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].weight > 0) {
      return entries[i].item;
    }
  }
  throw new Error('unreachable');
}

export function totalWeight<T>(entries: readonly Weighted<T>[]): number {
  return entries.reduce((sum, e) => sum + Math.max(0, e.weight), 0);
}

/** Probability of each entry in [0, 1]. */
export function probabilities<T>(entries: readonly Weighted<T>[]): number[] {
  const total = totalWeight(entries);
  return entries.map(e => (total > 0 ? Math.max(0, e.weight) / total : 0));
}
