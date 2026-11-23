import type { MockApiConfig } from '@app/config/api';
import {
  ApiError,
  defaultRng,
  RARITY_ORDER,
  rarityAtLeast,
  uuid,
  weightedPick,
  type Rng,
} from '@core/common';
import type { ActivityEntry, FeedEntry, TradeUpResponse } from '@core/modules/activity/types';
import { BOXES, WATCHES } from '@core/modules/catalog/fixtures';
import type { Box, Watch } from '@core/modules/catalog/types';
import { tradeUpChance } from '@core/modules/collection/tradeUp';
import type {
  OwnedWatch,
  Shipment,
  ShipmentStatus,
  ShippingAddress,
} from '@core/modules/collection/types';
import type { KeyValueStore } from '@core/shared/persistence/keyValueStore';

export type OpenBoxResponse = {
  /** In reveal order: least rare first, so a multi-open builds up to its best pull. */
  items: OwnedWatch[];
  balanceCents: number;
  /** Opens of this box since its last pity-rarity hit, after this purchase. */
  pityCount: number;
};
export type SellBackResponse = { balanceCents: number; creditedCents: number };
export type PityState = Record<string, number>;

type IdempotencyRecord = { op: string; fingerprint: string; response: unknown; createdAt: string };

type StoredShipment = Omit<Shipment, 'status' | 'timeline'> & { requestedAt: string };
type StoredItem = Omit<OwnedWatch, 'shipment'> & { shipment?: StoredShipment };

type ServerDb = {
  version: 2;
  balanceCents: number;
  inventory: StoredItem[];
  idempotency: Record<string, IdempotencyRecord>;
  ledger: ActivityEntry[];
  pity: PityState;
};

type DbV1 = {
  version: 1;
  balanceCents: number;
  inventory: Omit<StoredItem, 'origin'>[];
  idempotency: Record<string, unknown>;
};

type RequestOptions = { signal?: AbortSignal };

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export type MockServerOptions = {
  storage: KeyValueStore;
  config: MockApiConfig;
  /** Drives loot rolls and trade-ups. Seed it in tests for deterministic outcomes. Ids are random regardless. */
  rng?: Rng;
  /** Drives latency and simulated failures, kept separate from the loot roll. */
  chaosRng?: Rng;
  /** Drives the simulated players in the live feed. */
  feedRng?: Rng;
  sleep?: Sleep;
  now?: () => Date;
  catalog?: { boxes: Box[]; watches: Watch[] };
};

const DB_KEY = 'db';
const MAX_IDEMPOTENCY_RECORDS = 100;
const MAX_LEDGER = 500;
const MAX_FEED = 30;
const MAX_OPEN_COUNT = 10;
const FEED_NAMES = [
  'mila_k', 'tick.tock', 'jonas', 'aurora', 'dmitri_v', 'kenji', 'sofia.r', 'li_wei', 'marco',
  'nadia', 'oskar', 'priya', 'leo_g', 'yuki', 'hana', 'tomas', 'eva', 'raf',
];

export const abortableSleep: Sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError('aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new ApiError('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/**
 * In-process fake backend. It is the single source of truth for balance,
 * inventory, ledger and pity counters: outcomes are decided here, the UI only
 * animates a known result.
 *
 * Every handler builds the next DB snapshot in memory and persists it with a
 * single write, so a mutation is all-or-nothing. Money-moving mutations take an
 * idempotency key.
 */
export class MockServer {
  private readonly storage: KeyValueStore;
  private readonly config: MockApiConfig;
  private readonly rng: Rng;
  private readonly chaosRng: Rng;
  private readonly feedRng: Rng;
  private readonly sleep: Sleep;
  private readonly now: () => Date;
  private readonly boxes: Box[];
  private readonly watches: Watch[];
  /** The live feed is ephemeral (like a websocket stream), so it lives in memory. */
  private feed: FeedEntry[] = [];
  private feedClock = 0;

  constructor(options: MockServerOptions) {
    this.storage = options.storage;
    this.config = options.config;
    this.rng = options.rng ?? defaultRng;
    this.chaosRng = options.chaosRng ?? defaultRng;
    this.feedRng = options.feedRng ?? defaultRng;
    this.sleep = options.sleep ?? abortableSleep;
    this.now = options.now ?? (() => new Date());
    this.boxes = options.catalog?.boxes ?? BOXES;
    this.watches = options.catalog?.watches ?? WATCHES;
  }

  // ---------------------------------------------------------------- catalog

  getBoxes(opts?: RequestOptions): Promise<Box[]> {
    return this.request(opts, false, () => this.boxes);
  }

  getBox(boxId: string, opts?: RequestOptions): Promise<Box> {
    return this.request(opts, false, () => this.findBox(boxId));
  }

  getWatches(opts?: RequestOptions): Promise<Watch[]> {
    return this.request(opts, false, () => this.watches);
  }

  // ----------------------------------------------------------------- wallet

  getBalance(opts?: RequestOptions): Promise<number> {
    return this.request(opts, false, () => this.read().balanceCents);
  }

  topUp(opts?: RequestOptions): Promise<number> {
    return this.request(opts, true, () => {
      const db = this.read();
      const amount = this.config.topUpAmountCents;
      const next = { ...db, balanceCents: db.balanceCents + amount };
      this.write(this.log(next, { kind: 'topup', amountCents: amount }));
      return next.balanceCents;
    });
  }

  /** Newest first. */
  getActivity(opts?: RequestOptions): Promise<ActivityEntry[]> {
    return this.request(opts, false, () => [...this.read().ledger].reverse());
  }

  getPity(opts?: RequestOptions): Promise<PityState> {
    return this.request(opts, false, () => this.read().pity);
  }

  // ------------------------------------------------------------- collection

  getCollection(opts?: RequestOptions): Promise<OwnedWatch[]> {
    return this.request(opts, false, () =>
      this.read()
        .inventory.map(i => this.present(i))
        .sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt)),
    );
  }

  /** Idempotent: marking an already revealed item is a no-op. */
  markRevealed(instanceId: string, opts?: RequestOptions): Promise<OwnedWatch> {
    return this.request(opts, true, () => {
      const db = this.read();
      const item = this.findItem(db, instanceId);
      if (item.revealed) {
        return this.present(item);
      }
      const updated = { ...item, revealed: true };
      this.write({ ...db, inventory: db.inventory.map(i => (i.instanceId === instanceId ? updated : i)) });
      return this.present(updated);
    });
  }

  sellBack(instanceId: string, opts?: RequestOptions): Promise<SellBackResponse> {
    return this.request(opts, true, () => {
      const db = this.read();
      const item = this.findItem(db, instanceId);
      // Selling straight from the reveal screen may race the markRevealed call,
      // so only a shipment blocks a sale.
      if (item.shipment) {
        throw new ApiError('invalid', 'This watch has left the vault');
      }
      const watch = this.findWatch(item.watchId);
      const creditedCents = Math.round(watch.valueCents * this.config.sellBackRatio);
      const next: ServerDb = {
        ...db,
        balanceCents: db.balanceCents + creditedCents,
        inventory: db.inventory.filter(i => i.instanceId !== instanceId),
      };
      this.write(this.log(next, { kind: 'sell', watchId: watch.id, amountCents: creditedCents }));
      return { balanceCents: next.balanceCents, creditedCents };
    });
  }

  /** Moves a vaulted watch into delivery. The status then advances with time. */
  requestShipping(
    instanceId: string,
    address: ShippingAddress,
    idempotencyKey: string,
    opts?: RequestOptions,
  ): Promise<OwnedWatch> {
    return this.request(opts, true, () => {
      const db = this.read();
      return this.idempotent(db, 'ship', idempotencyKey, instanceId, () => {
        const item = this.findItem(db, instanceId);
        this.assertInVault(item);
        const missing = (Object.keys(address) as (keyof ShippingAddress)[]).filter(k => !address[k]?.trim());
        if (missing.length) {
          throw new ApiError('invalid', `Missing address fields: ${missing.join(', ')}`);
        }
        const shipment: StoredShipment = {
          id: uuid(),
          trackingCode: `MW${Math.floor(defaultRng() * 1e9).toString().padStart(9, '0')}`,
          address: { ...address },
          requestedAt: this.now().toISOString(),
        };
        const updated: StoredItem = { ...item, shipment };
        const next = this.log(
          { ...db, inventory: db.inventory.map(i => (i.instanceId === instanceId ? updated : i)) },
          { kind: 'ship', watchId: item.watchId, amountCents: 0 },
        );
        return { db: next, response: this.present(updated) };
      });
    });
  }

  /**
   * Stakes vaulted watches for a chance at a pricier one. The stake is always
   * consumed; on a win the target is added to the vault.
   */
  tradeUp(
    instanceIds: string[],
    targetWatchId: string,
    idempotencyKey: string,
    opts?: RequestOptions,
  ): Promise<TradeUpResponse> {
    return this.request(opts, true, () => {
      const db = this.read();
      const fingerprint = `${[...instanceIds].sort().join(',')}→${targetWatchId}`;
      return this.idempotent(db, 'tradeup', idempotencyKey, fingerprint, () => {
        const ids = [...new Set(instanceIds)];
        if (ids.length === 0 || ids.length > this.config.tradeUp.maxStakeItems) {
          throw new ApiError('invalid', 'Pick between 1 and the maximum number of watches');
        }
        const stake = ids.map(id => this.findItem(db, id));
        stake.forEach(i => this.assertInVault(i));
        const target = this.findWatch(targetWatchId);
        const stakeCents = stake.reduce((sum, i) => sum + this.findWatch(i.watchId).valueCents, 0);
        const chance = tradeUpChance(stakeCents, target.valueCents, this.config.tradeUp);
        if (chance <= 0) {
          throw new ApiError('invalid', 'The target must be worth more than the stake');
        }

        const roll = this.rng();
        const won = roll < chance;
        const item: StoredItem | null = won
          ? {
              instanceId: uuid(),
              watchId: target.id,
              boxId: null,
              origin: 'tradeup',
              acquiredAt: this.now().toISOString(),
              revealed: true,
            }
          : null;
        const remaining = db.inventory.filter(i => !ids.includes(i.instanceId));
        const next = this.log(
          { ...db, inventory: item ? [...remaining, item] : remaining },
          {
            kind: 'tradeup',
            stakeWatchIds: stake.map(i => i.watchId),
            targetWatchId: target.id,
            chance,
            won,
            amountCents: 0,
          },
        );
        const response: TradeUpResponse = {
          won,
          chance,
          roll,
          item: item ? this.present(item) : null,
          consumedInstanceIds: ids,
          balanceCents: db.balanceCents,
        };
        return { db: next, response };
      });
    });
  }

  // ---------------------------------------------------------------- opening

  /**
   * Atomically: check funds → roll `count` times (with pity) → debit → add to
   * inventory → respond. Replaying the same idempotency key returns the
   * original result and never debits twice.
   */
  openBox(
    boxId: string,
    idempotencyKey: string,
    opts?: RequestOptions & { count?: number },
  ): Promise<OpenBoxResponse> {
    const count = opts?.count ?? 1;
    return this.request(opts, true, () => {
      const db = this.read();
      return this.idempotent(db, 'open', idempotencyKey, `${boxId}×${count}`, () => {
        if (!Number.isInteger(count) || count < 1 || count > MAX_OPEN_COUNT) {
          throw new ApiError('invalid', `count must be 1…${MAX_OPEN_COUNT}`);
        }
        const box = this.findBox(boxId);
        const total = box.priceCents * count;
        if (db.balanceCents < total) {
          throw new ApiError('insufficient_funds');
        }

        let pityCount = db.pity[boxId] ?? 0;
        const createdAt = this.now().toISOString();
        const items: StoredItem[] = [];
        for (let n = 0; n < count; n++) {
          const watch = this.roll(box, pityCount);
          pityCount = rarityAtLeast(watch.rarity, box.pity.minRarity) ? 0 : pityCount + 1;
          items.push({
            instanceId: uuid(),
            watchId: watch.id,
            boxId,
            origin: 'box',
            acquiredAt: createdAt,
            revealed: false,
          });
        }
        const ordered = this.revealOrder(items);
        const response: OpenBoxResponse = {
          items: ordered.map(i => this.present(i)),
          balanceCents: db.balanceCents - total,
          pityCount,
        };

        const next = this.log(
          {
            ...db,
            balanceCents: response.balanceCents,
            inventory: [...db.inventory, ...ordered],
            pity: { ...db.pity, [boxId]: pityCount },
          },
          { kind: 'open', boxId, count, amountCents: -total, watchIds: ordered.map(i => i.watchId) },
        );
        this.pushOwnPulls(ordered, createdAt);
        return { db: next, response };
      });
    });
  }

  // ------------------------------------------------------------------- feed

  /**
   * Recent notable pulls, newest first. Simulated players "open" boxes in the
   * background at `feedIntervalMs` on average; the user's own rare+ pulls are
   * mixed in.
   */
  getFeed(opts?: RequestOptions): Promise<FeedEntry[]> {
    return this.request(opts, false, () => {
      this.advanceFeed();
      return this.feed;
    });
  }

  // ------------------------------------------------------------------- misc

  /** Dev helper: wipe the database back to the starting balance. */
  reset(): void {
    this.storage.remove(DB_KEY);
    this.feed = [];
    this.feedClock = 0;
  }

  // -------------------------------------------------------------- internals

  /**
   * Simulates a round trip:
   *   request travels → may fail → handler commits → response travels → may be lost.
   * An abort before the commit has no effect on the DB; an abort after it only
   * loses the response (the client should retry with the same key).
   */
  private async request<T>(
    opts: RequestOptions | undefined,
    isMutation: boolean,
    handler: () => T,
  ): Promise<T> {
    const signal = opts?.signal;
    const [min, max] = this.config.latencyMs;
    const latency = min + (max - min) * this.chaosRng();

    await this.sleep(latency / 2, signal);
    if (this.chaosRng() < this.config.failRate) {
      throw new ApiError('network', 'Request failed (simulated)');
    }
    if (signal?.aborted) {
      throw new ApiError('aborted');
    }

    const result = handler();

    await this.sleep(latency / 2, signal);
    if (isMutation && this.chaosRng() < this.config.lostResponseRate) {
      throw new ApiError('network', 'Response lost (simulated)');
    }
    // Hand out copies so callers can never mutate server state by reference.
    return clone(result);
  }

  /** Replays a stored response for a known key, or runs `run` and stores its response with the new DB. */
  private idempotent<T>(
    db: ServerDb,
    op: string,
    key: string,
    fingerprint: string,
    run: () => { db: ServerDb; response: T },
  ): T {
    const previous = db.idempotency[key];
    if (previous) {
      if (previous.op !== op || previous.fingerprint !== fingerprint) {
        throw new ApiError('conflict', 'Idempotency key reused for a different request');
      }
      return previous.response as T;
    }
    const { db: next, response } = run();
    this.write({
      ...next,
      idempotency: pruneIdempotency({
        ...next.idempotency,
        [key]: { op, fingerprint, response: clone(response), createdAt: this.now().toISOString() },
      }),
    });
    return response;
  }

  private roll(box: Box, pityCount: number): Watch {
    const forced = pityCount >= box.pity.within - 1;
    const pool = box.contents.filter(
      c => !forced || rarityAtLeast(this.findWatch(c.watchId).rarity, box.pity.minRarity),
    );
    const watchId = weightedPick(
      pool.map(c => ({ item: c.watchId, weight: c.weight })),
      this.rng,
    );
    return this.findWatch(watchId);
  }

  private revealOrder(items: StoredItem[]): StoredItem[] {
    const score = (i: StoredItem) => {
      const w = this.findWatch(i.watchId);
      return RARITY_ORDER[w.rarity] * 1e12 + w.valueCents;
    };
    return items
      .map((item, index) => ({ item, index, score: score(item) }))
      .sort((a, b) => a.score - b.score || a.index - b.index)
      .map(x => x.item);
  }

  /** Adds derived shipment status for the client. */
  private present(item: StoredItem): OwnedWatch {
    const { shipment, ...rest } = item;
    if (!shipment) {
      return rest;
    }
    const { requestedAt, ...shipmentRest } = shipment;
    const start = Date.parse(requestedAt);
    const elapsed = this.now().getTime() - start;
    const step = this.config.shippingStepMs;
    const steps: { status: ShipmentStatus; offset: number }[] = [
      { status: 'processing', offset: 0 },
      { status: 'shipped', offset: step },
      { status: 'delivered', offset: step * 2 },
    ];
    const timeline = steps
      .filter(s => elapsed >= s.offset)
      .map(s => ({ status: s.status, at: new Date(start + s.offset).toISOString() }));
    return {
      ...rest,
      shipment: { ...shipmentRest, status: timeline[timeline.length - 1].status, timeline },
    };
  }

  private assertInVault(item: StoredItem) {
    if (!item.revealed) {
      throw new ApiError('invalid', 'Open this box first');
    }
    if (item.shipment) {
      throw new ApiError('invalid', 'This watch has left the vault');
    }
  }

  private log(db: ServerDb, entry: DistributiveOmit<ActivityEntry, 'id' | 'at'>): ServerDb {
    const full = { ...entry, id: uuid(), at: this.now().toISOString() } as ActivityEntry;
    return { ...db, ledger: [...db.ledger, full].slice(-MAX_LEDGER) };
  }

  private pushOwnPulls(items: StoredItem[], at: string) {
    const notable = items.filter(i => i.boxId && rarityAtLeast(this.findWatch(i.watchId).rarity, 'rare'));
    const entries = notable.map(i => ({
      id: i.instanceId,
      at,
      user: 'You',
      isYou: true,
      boxId: i.boxId!,
      watchId: i.watchId,
    }));
    this.feed = [...entries.reverse(), ...this.feed].slice(0, MAX_FEED);
  }

  private advanceFeed() {
    const now = this.now().getTime();
    const interval = this.config.feedIntervalMs;
    if (this.feedClock === 0) {
      // Cold start: backfill a few minutes of history so the ticker isn't empty.
      this.feedClock = now - interval * 12;
    }
    const generated: FeedEntry[] = [];
    // Bounded per call so a long background stint doesn't flood the list.
    for (let n = 0; n < 12 && this.feedClock + interval <= now; n++) {
      this.feedClock += interval * (0.5 + this.feedRng());
      const entry = this.simulatePull(Math.min(this.feedClock, now));
      if (entry) {
        generated.push(entry);
      }
    }
    if (this.feedClock + interval * 12 < now) {
      this.feedClock = now;
    }
    this.feed = [...generated.reverse(), ...this.feed].slice(0, MAX_FEED);
  }

  /** One pull by a simulated player. Only notable pulls make the feed, like on the real thing. */
  private simulatePull(at: number): FeedEntry | null {
    // Cheaper boxes are opened more often.
    const box = weightedPick(
      this.boxes.map(b => ({ item: b, weight: 1 / Math.sqrt(b.priceCents) })),
      this.feedRng,
    );
    const watchId = weightedPick(
      box.contents.map(c => ({ item: c.watchId, weight: c.weight })),
      this.feedRng,
    );
    const watch = this.findWatch(watchId);
    // Commons are only occasionally shown; otherwise the feed would be all quartz.
    if (watch.rarity === 'common' && this.feedRng() > 0.15) {
      return null;
    }
    return {
      id: uuid(this.feedRng),
      at: new Date(at).toISOString(),
      user: FEED_NAMES[Math.floor(this.feedRng() * FEED_NAMES.length)],
      isYou: false,
      boxId: box.id,
      watchId,
    };
  }

  private read(): ServerDb {
    const raw = this.storage.getString(DB_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as ServerDb | DbV1;
        if (parsed.version === 2) {
          return parsed;
        }
        if (parsed.version === 1) {
          const migrated = migrateV1(parsed);
          this.write(migrated);
          return migrated;
        }
      } catch {
        // Corrupt DB: fall through and reseed.
      }
    }
    const seed: ServerDb = {
      version: 2,
      balanceCents: this.config.startBalanceCents,
      inventory: [],
      idempotency: {},
      ledger: [],
      pity: {},
    };
    this.write(seed);
    return seed;
  }

  private write(db: ServerDb): void {
    this.storage.set(DB_KEY, JSON.stringify(db));
  }

  private findItem(db: ServerDb, instanceId: string): StoredItem {
    const item = db.inventory.find(i => i.instanceId === instanceId);
    if (!item) {
      throw new ApiError('not_found', `Item ${instanceId} not found`);
    }
    return item;
  }

  private findBox(boxId: string): Box {
    const box = this.boxes.find(b => b.id === boxId);
    if (!box) {
      throw new ApiError('not_found', `Box ${boxId} not found`);
    }
    return box;
  }

  private findWatch(watchId: string): Watch {
    const watch = this.watches.find(w => w.id === watchId);
    if (!watch) {
      throw new ApiError('not_found', `Watch ${watchId} not found`);
    }
    return watch;
  }
}

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

/** v1 had single-item opens, no ledger and no pity. Old idempotency records are dropped (different shape). */
function migrateV1(db: DbV1): ServerDb {
  return {
    version: 2,
    balanceCents: db.balanceCents,
    inventory: db.inventory.map(i => ({ ...i, origin: 'box' as const })),
    idempotency: {},
    ledger: [],
    pity: {},
  };
}

function pruneIdempotency(records: Record<string, IdempotencyRecord>) {
  const entries = Object.entries(records);
  if (entries.length <= MAX_IDEMPOTENCY_RECORDS) {
    return records;
  }
  entries.sort((a, b) => b[1].createdAt.localeCompare(a[1].createdAt));
  return Object.fromEntries(entries.slice(0, MAX_IDEMPOTENCY_RECORDS));
}

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
