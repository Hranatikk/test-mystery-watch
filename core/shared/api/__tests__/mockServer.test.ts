import { ApiError, createSeededRng, isApiError } from '@core/common';
import type { MockApiConfig } from '@app/config/api';
import { createMemoryStore } from '@core/shared/persistence/keyValueStore';
import { BOXES, WATCHES } from '@core/modules/catalog/fixtures';
import { MockServer, type Sleep } from '../mockServer';

const config: MockApiConfig = {
  latencyMs: [0, 0],
  failRate: 0,
  lostResponseRate: 0,
  startBalanceCents: 100_000,
  topUpAmountCents: 50_000,
  sellBackRatio: 0.8,
  tradeUp: { houseEdge: 0.1, maxChance: 0.75, maxStakeItems: 10 },
  shippingStepMs: 60_000,
  feedIntervalMs: 5_000,
};

const instantSleep: Sleep = async (_ms, signal) => {
  if (signal?.aborted) {
    throw new ApiError('aborted');
  }
};

/** Returns a chaos rng that yields the given values in order, then 0.99 (no failure). */
function scriptedChaos(values: number[]) {
  const queue = [...values];
  return () => (queue.length ? queue.shift()! : 0.99);
}

function makeServer(overrides: Partial<ConstructorParameters<typeof MockServer>[0]> = {}) {
  const storage = overrides.storage ?? createMemoryStore();
  const server = new MockServer({
    storage,
    config,
    rng: createSeededRng(42),
    chaosRng: () => 0.99,
    sleep: instantSleep,
    now: () => new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });
  return { server, storage };
}

describe('MockServer.openBox', () => {
  it('debits the price and adds an unrevealed item atomically', async () => {
    const { server } = makeServer();
    const res = await server.openBox('b_icy', 'key-1');

    expect(res.balanceCents).toBe(100_000 - 14_900);
    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toMatchObject({ boxId: 'b_icy', origin: 'box', revealed: false });
    expect(await server.getBalance()).toBe(res.balanceCents);
    expect(await server.getCollection()).toEqual(res.items);
  });

  it('is deterministic for a given seed', async () => {
    const roll = async () => {
      const { server } = makeServer({ rng: createSeededRng(7), config: { ...config, startBalanceCents: 10_000_000 } });
      const ids: string[] = [];
      for (let i = 0; i < 20; i++) {
        ids.push((await server.openBox('b_emerald', `k${i}`)).items[0].watchId);
      }
      return ids;
    };
    expect(await roll()).toEqual(await roll());
  });

  it('rolls proportionally to weights', async () => {
    // Pity off for this test: it must measure the raw weights.
    const boxes = BOXES.map(b => ({ ...b, pity: { ...b.pity, within: 1_000_000 } }));
    const { server } = makeServer({
      rng: createSeededRng(1),
      config: { ...config, startBalanceCents: 100_000_000_000 },
      catalog: { boxes, watches: WATCHES },
    });
    const counts: Record<string, number> = {};
    const N = 4_000;
    for (let i = 0; i < N; i++) {
      const [item] = (await server.openBox('b_emerald', `k${i}`)).items;
      counts[item.watchId] = (counts[item.watchId] ?? 0) + 1;
    }
    // Emerald weights: 60% / 25% / 11% / 4%
    expect(counts.w_casio / N).toBeCloseTo(0.6, 1);
    expect(counts.w_perpetual / N).toBeCloseTo(0.25, 1);
    expect(counts.w_gmt / N).toBeCloseTo(0.11, 1);
    expect(counts.w_sky / N).toBeCloseTo(0.04, 1);
  });

  it('rejects with insufficient_funds and leaves the DB untouched', async () => {
    const { server, storage } = makeServer({ config: { ...config, startBalanceCents: 100 } });
    await server.getBalance(); // seed
    const before = storage.getString('db');

    await expect(server.openBox('b_icy', 'key-1')).rejects.toMatchObject({ code: 'insufficient_funds' });
    expect(storage.getString('db')).toBe(before);
  });

  it('replaying an idempotency key returns the same result and never debits twice', async () => {
    const { server } = makeServer();
    const first = await server.openBox('b_icy', 'same-key');
    const second = await server.openBox('b_icy', 'same-key');

    expect(second).toEqual(first);
    expect(await server.getBalance()).toBe(100_000 - 14_900);
    expect(await server.getCollection()).toHaveLength(1);
  });

  it('a lost response followed by a retry with the same key charges once', async () => {
    // chaos sequence for 1st call: [pre-commit fail check, lost-response check]
    const { server } = makeServer({ chaosRng: scriptedChaos([0, 0.99, 0.0]), config: { ...config, lostResponseRate: 0.5 } });

    let error: unknown;
    try {
      await server.openBox('b_icy', 'k');
    } catch (e) {
      error = e;
    }
    expect(isApiError(error, 'network')).toBe(true);
    // The server did commit despite the client seeing a failure.
    expect(await server.getCollection()).toHaveLength(1);

    const retried = await server.openBox('b_icy', 'k');
    expect(retried.balanceCents).toBe(100_000 - 14_900);
    expect(await server.getBalance()).toBe(100_000 - 14_900);
    expect(await server.getCollection()).toHaveLength(1);
  });

  it('a request that fails before reaching the server has no effect', async () => {
    const { server } = makeServer({ chaosRng: scriptedChaos([0, 0]), config: { ...config, failRate: 0.5 } });
    await expect(server.openBox('b_icy', 'k')).rejects.toMatchObject({ code: 'network' });
    expect(await server.getBalance()).toBe(100_000);
    expect(await server.getCollection()).toHaveLength(0);
  });

  it('refuses to reuse a key for a different box', async () => {
    const { server } = makeServer();
    await server.openBox('b_icy', 'k');
    await expect(server.openBox('b_midnight', 'k')).rejects.toMatchObject({ code: 'conflict' });
  });

  it('honours AbortSignal before commit', async () => {
    const { server } = makeServer();
    const controller = new AbortController();
    controller.abort();
    await expect(server.openBox('b_icy', 'k', { signal: controller.signal })).rejects.toMatchObject({
      code: 'aborted',
    });
    expect(await server.getBalance()).toBe(100_000);
  });

  it('persists across server instances sharing the same storage', async () => {
    const { server, storage } = makeServer();
    const { items } = await server.openBox('b_icy', 'k');
    const restarted = new MockServer({ storage, config, sleep: instantSleep, chaosRng: () => 0.99 });
    expect(await restarted.getCollection()).toEqual(items);
  });
});

describe('MockServer collection & wallet', () => {
  it('markRevealed is idempotent', async () => {
    const { server } = makeServer();
    const [item] = (await server.openBox('b_icy', 'k')).items;
    await server.markRevealed(item.instanceId);
    const again = await server.markRevealed(item.instanceId);
    expect(again.revealed).toBe(true);
  });

  it('sellBack credits a share of the value and removes the item', async () => {
    const { server } = makeServer({ config: { ...config, startBalanceCents: 1_000_000 } });
    const {
      items: [item],
      balanceCents,
    } = await server.openBox('b_reserve', 'k');
    const watch = (await server.getWatches()).find(w => w.id === item.watchId)!;
    const res = await server.sellBack(item.instanceId);
    expect(res.creditedCents).toBe(Math.round(watch.valueCents * 0.8));
    expect(res.balanceCents).toBe(balanceCents + res.creditedCents);
    expect(await server.getCollection()).toHaveLength(0);
  });

  it('topUp adds the configured amount', async () => {
    const { server } = makeServer();
    expect(await server.topUp()).toBe(150_000);
  });
});

let keySeq = 0;
/** Opens until one of `watchIds` shows up, returning that item. Every open gets a fresh key. */
async function openUntil(server: MockServer, boxId: string, watchIds: string[]) {
  for (let i = 0; i < 500; i++) {
    const [item] = (await server.openBox(boxId, `until-${++keySeq}`)).items;
    if (watchIds.includes(item.watchId)) {
      return item;
    }
  }
  throw new Error('not found');
}

describe('MockServer multi-open & pity', () => {
  const rich = { ...config, startBalanceCents: 100_000_000 };

  it('opens N boxes in one atomic charge, in reveal order (best last)', async () => {
    const { server } = makeServer({ config: rich, rng: createSeededRng(3) });
    const watches = await server.getWatches();
    const rank = (id: string) => ['common', 'rare', 'epic', 'legendary'].indexOf(watches.find(w => w.id === id)!.rarity);

    const res = await server.openBox('b_emerald', 'multi', { count: 5 });
    expect(res.items).toHaveLength(5);
    expect(res.balanceCents).toBe(100_000_000 - 5 * 359_900);
    const ranks = res.items.map(i => rank(i.watchId));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(await server.getCollection()).toHaveLength(5);
  });

  it('refuses a multi-open it cannot fully pay for, charging nothing', async () => {
    const { server } = makeServer({ config: { ...config, startBalanceCents: 14_900 * 2 } });
    await expect(server.openBox('b_icy', 'k', { count: 3 })).rejects.toMatchObject({ code: 'insufficient_funds' });
    expect(await server.getBalance()).toBe(29_800);
  });

  it('treats a replayed key with a different count as a conflict', async () => {
    const { server } = makeServer({ config: rich });
    await server.openBox('b_icy', 'k', { count: 3 });
    await expect(server.openBox('b_icy', 'k', { count: 1 })).rejects.toMatchObject({ code: 'conflict' });
  });

  it('guarantees the pity rarity once the counter runs out', async () => {
    // rng always lands on the first (common) bucket unless the pool is restricted.
    const { server } = makeServer({ config: rich, rng: () => 0 });
    const icy = BOXES.find(b => b.id === 'b_icy')!;
    const watches = await server.getWatches();
    const rarities: string[] = [];
    let last;
    for (let n = 0; rarities.length < icy.pity.within; n++) {
      last = await server.openBox('b_icy', `pity-${n}`, { count: Math.min(10, icy.pity.within - rarities.length) });
      rarities.push(...last.items.map(i => watches.find(w => w.id === i.watchId)!.rarity));
    }

    expect(rarities.filter(r => r === 'common')).toHaveLength(icy.pity.within - 1);
    expect(rarities).toContain('rare');
    expect(last!.pityCount).toBe(0);
    expect(await server.getPity()).toEqual({ b_icy: 0 });
  });

  it('counts opens without a hit per box', async () => {
    const { server } = makeServer({ config: rich, rng: () => 0 });
    await server.openBox('b_icy', 'a', { count: 3 });
    await server.openBox('b_midnight', 'b');
    expect(await server.getPity()).toEqual({ b_icy: 3, b_midnight: 1 });
  });
});

describe('MockServer ledger', () => {
  it('records opens, sales and top-ups, newest first', async () => {
    const { server } = makeServer();
    const [item] = (await server.openBox('b_icy', 'k', { count: 1 })).items;
    await server.sellBack(item.instanceId);
    await server.topUp();
    const activity = await server.getActivity();
    expect(activity.map(a => a.kind)).toEqual(['topup', 'sell', 'open']);
    expect(activity[2]).toMatchObject({ kind: 'open', boxId: 'b_icy', count: 1, amountCents: -14_900 });
    expect(activity[1].amountCents).toBeGreaterThan(0);
  });

  it('a replayed purchase is logged once', async () => {
    const { server } = makeServer();
    await server.openBox('b_icy', 'same');
    await server.openBox('b_icy', 'same');
    expect(await server.getActivity()).toHaveLength(1);
  });
});

describe('MockServer trade-up', () => {
  const rich = { ...config, startBalanceCents: 100_000_000 };

  async function vaultedCasios(server: MockServer, n: number) {
    const items = [];
    for (let i = 0; i < n; i++) {
      const item = await openUntil(server, 'b_icy', ['w_casio']);
      await server.markRevealed(item.instanceId);
      items.push(item);
    }
    return items;
  }

  it('consumes the stake and adds the target on a win', async () => {
    const { server, storage } = makeServer({ config: rich });
    const stake = await vaultedCasios(server, 3);
    // Force the roll: a fresh server over the same storage with rng → 0.
    const lucky = new MockServer({ storage, config: rich, rng: () => 0, chaosRng: () => 0.99, sleep: instantSleep });
    const res = await lucky.tradeUp(stake.map(i => i.instanceId), 'w_perpetual', 'tu-1');

    expect(res.won).toBe(true);
    expect(res.chance).toBeCloseTo((3 * 6_500 * 0.9) / 650_000, 6);
    expect(res.item).toMatchObject({ watchId: 'w_perpetual', origin: 'tradeup', boxId: null, revealed: true });
    const owned = await lucky.getCollection();
    expect(owned.map(i => i.instanceId)).toEqual(expect.not.arrayContaining(stake.map(i => i.instanceId)));
    expect(owned.some(i => i.watchId === 'w_perpetual')).toBe(true);
  });

  it('consumes the stake and adds nothing on a miss; replay is idempotent', async () => {
    const { server, storage } = makeServer({ config: rich });
    const stake = await vaultedCasios(server, 2);
    const unlucky = new MockServer({ storage, config: rich, rng: () => 0.999, chaosRng: () => 0.99, sleep: instantSleep });
    const ids = stake.map(i => i.instanceId);
    const res = await unlucky.tradeUp(ids, 'w_gmt', 'tu-2');
    expect(res.won).toBe(false);
    expect(res.item).toBeNull();
    expect(await unlucky.tradeUp(ids, 'w_gmt', 'tu-2')).toEqual(res);
    expect((await unlucky.getCollection()).filter(i => ids.includes(i.instanceId))).toHaveLength(0);
  });

  it('rejects targets worth less than the stake, unrevealed items and unknown items', async () => {
    const { server } = makeServer({ config: rich });
    const [casio] = await vaultedCasios(server, 1);
    await expect(server.tradeUp([casio.instanceId], 'w_casio', 'a')).rejects.toMatchObject({ code: 'invalid' });
    const [fresh] = (await server.openBox('b_icy', 'fresh')).items;
    await expect(server.tradeUp([fresh.instanceId], 'w_sky', 'b')).rejects.toMatchObject({ code: 'invalid' });
    await expect(server.tradeUp(['nope'], 'w_sky', 'c')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('MockServer shipping', () => {
  it('moves an item into delivery and advances its status with time', async () => {
    let now = new Date('2026-01-01T00:00:00Z').getTime();
    const { server } = makeServer({ now: () => new Date(now) });
    const [item] = (await server.openBox('b_icy', 'k')).items;
    await server.markRevealed(item.instanceId);
    const address = { fullName: 'A B', line1: '1 Main St', city: 'Zurich', postalCode: '8001', country: 'CH' };

    const shipped = await server.requestShipping(item.instanceId, address, 'ship-1');
    expect(shipped.shipment?.status).toBe('processing');

    now += 60_000;
    expect((await server.getCollection())[0].shipment?.status).toBe('shipped');
    now += 60_000;
    const delivered = (await server.getCollection())[0].shipment!;
    expect(delivered.status).toBe('delivered');
    expect(delivered.timeline.map(s => s.status)).toEqual(['processing', 'shipped', 'delivered']);

    // Replay returns the stored response; the item can no longer be sold.
    expect((await server.requestShipping(item.instanceId, address, 'ship-1')).shipment?.status).toBe('processing');
    await expect(server.sellBack(item.instanceId)).rejects.toMatchObject({ code: 'invalid' });
  });

  it('validates the address', async () => {
    const { server } = makeServer();
    const [item] = (await server.openBox('b_icy', 'k')).items;
    await server.markRevealed(item.instanceId);
    await expect(
      server.requestShipping(item.instanceId, { fullName: ' ', line1: 'x', city: 'y', postalCode: '1', country: 'z' }, 's'),
    ).rejects.toMatchObject({ code: 'invalid' });
  });
});

describe('MockServer feed & migration', () => {
  it('backfills simulated pulls and mixes in your notable ones', async () => {
    const { server } = makeServer({ feedRng: createSeededRng(5), rng: () => 0.9999, config: { ...config, startBalanceCents: 10_000_000 } });
    const feed = await server.getFeed();
    expect(feed.length).toBeGreaterThan(0);
    expect(feed.every(e => !e.isYou)).toBe(true);

    await server.openBox('b_reserve', 'k'); // rng → last bucket = legendary
    const after = await server.getFeed();
    expect(after[0]).toMatchObject({ user: 'You', isYou: true, boxId: 'b_reserve' });
  });

  it('migrates a v1 database (single-item opens, no ledger)', async () => {
    const storage = createMemoryStore();
    storage.set(
      'db',
      JSON.stringify({
        version: 1,
        balanceCents: 1234,
        inventory: [{ instanceId: 'old', watchId: 'w_casio', boxId: 'b_icy', acquiredAt: '2025-01-01T00:00:00Z', revealed: true }],
        idempotency: {},
      }),
    );
    const { server } = makeServer({ storage });
    expect(await server.getBalance()).toBe(1234);
    expect((await server.getCollection())[0]).toMatchObject({ instanceId: 'old', origin: 'box' });
    expect(await server.getActivity()).toEqual([]);
  });
});
