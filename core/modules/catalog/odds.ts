import { compareRarityDesc, probabilities } from '@core/common';
import type { Box, Watch } from './types';

export type BoxOdd = { watch: Watch; probability: number };

/** Box contents joined with watch data, rarest first. */
export function boxOdds(box: Box, watchesById: Record<string, Watch>): BoxOdd[] {
  const probs = probabilities(box.contents.map(c => ({ item: c.watchId, weight: c.weight })));
  return box.contents
    .map((c, i) => ({ watch: watchesById[c.watchId], probability: probs[i] }))
    .filter((o): o is BoxOdd => o.watch != null)
    .sort((a, b) => compareRarityDesc(a.watch.rarity, b.watch.rarity));
}

export function formatProbability(p: number): string {
  const pct = p * 100;
  if (pct >= 10) {
    return `${pct.toFixed(0)}%`;
  }
  if (pct >= 1) {
    return `${pct.toFixed(1)}%`;
  }
  return `${pct.toFixed(2)}%`;
}

export function expectedValueCents(box: Box, watchesById: Record<string, Watch>): number {
  return boxOdds(box, watchesById).reduce(
    (sum, o) => sum + o.probability * o.watch.valueCents,
    0,
  );
}

/** Opens left until the pity rule guarantees `minRarity`+ (1 = the next open is guaranteed). */
export function opensUntilPity(box: Box, pityCount: number): number {
  return Math.max(1, box.pity.within - pityCount);
}
