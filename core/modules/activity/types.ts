import type { Cents } from '@core/common';
import type { OwnedWatch } from '@core/modules/collection/types';

type Base = { id: string; at: string };

/** Server-side ledger. `amountCents` is the effect on the balance (signed). */
export type ActivityEntry =
  | (Base & { kind: 'open'; boxId: string; count: number; amountCents: Cents; watchIds: string[] })
  | (Base & { kind: 'sell'; watchId: string; amountCents: Cents })
  | (Base & { kind: 'topup'; amountCents: Cents })
  | (Base & {
      kind: 'tradeup';
      stakeWatchIds: string[];
      targetWatchId: string;
      chance: number;
      won: boolean;
      amountCents: 0;
    })
  | (Base & { kind: 'ship'; watchId: string; amountCents: 0 });

/** Social-proof ticker: recent pulls by (simulated) other players and by you. */
export type FeedEntry = {
  id: string;
  at: string;
  user: string;
  isYou: boolean;
  boxId: string;
  watchId: string;
};

export type TradeUpResponse = {
  won: boolean;
  /** Win chance that was offered, 0…1. */
  chance: number;
  /** The server's roll, 0…1; a win when `roll < chance`. Lets the UI land the needle honestly. */
  roll: number;
  item: OwnedWatch | null;
  consumedInstanceIds: string[];
  balanceCents: Cents;
};
