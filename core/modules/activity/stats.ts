import type { Watch } from '@core/modules/catalog/types';
import type { OwnedWatch } from '@core/modules/collection/types';
import type { ActivityEntry } from './types';

export type ProfitAndLoss = {
  /** Paid for boxes. */
  spentCents: number;
  /** Credited from sell-backs. */
  soldCents: number;
  /** Market value of revealed watches still owned (vault, in transit or delivered). */
  heldCents: number;
  /** held + sold − spent. Unopened boxes are not counted until revealed. */
  netCents: number;
  boxesOpened: number;
  unopened: number;
};

/** Derived on the client from the server ledger, so it can never drift from the balance. */
export function profitAndLoss(
  activity: ActivityEntry[],
  collection: OwnedWatch[],
  watchesById: Record<string, Watch>,
): ProfitAndLoss {
  let spentCents = 0;
  let soldCents = 0;
  let boxesOpened = 0;
  for (const e of activity) {
    if (e.kind === 'open') {
      spentCents += -e.amountCents;
      boxesOpened += e.count;
    } else if (e.kind === 'sell') {
      soldCents += e.amountCents;
    }
  }
  const heldCents = collection
    .filter(i => i.revealed)
    .reduce((sum, i) => sum + (watchesById[i.watchId]?.valueCents ?? 0), 0);
  return {
    spentCents,
    soldCents,
    heldCents,
    netCents: heldCents + soldCents - spentCents,
    boxesOpened,
    unopened: collection.filter(i => !i.revealed).length,
  };
}
