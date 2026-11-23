import { dollars } from '@core/common';

export type MockApiConfig = {
  /** Random latency range for every request, ms. */
  latencyMs: readonly [min: number, max: number];
  /** Probability that a request fails before the server processes it. */
  failRate: number;
  /**
   * Probability that a mutation is committed on the server but the response is
   * "lost" on the way back. This is exactly the case idempotency keys exist for.
   */
  lostResponseRate: number;
  startBalanceCents: number;
  topUpAmountCents: number;
  /** Share of a watch's value refunded when selling it back. */
  sellBackRatio: number;
  /** Trade-up: chance = stake × (1 − houseEdge) / target, capped. */
  tradeUp: { houseEdge: number; maxChance: number; maxStakeItems: number };
  /** Time from requesting delivery to `shipped` and then to `delivered` (sped up for the demo). */
  shippingStepMs: number;
  /** Simulated other players: average gap between their pulls in the live feed. */
  feedIntervalMs: number;
};

export const mockApiConfig: MockApiConfig = {
  latencyMs: [350, 900],
  failRate: __DEV__ ? 0.08 : 0.04,
  lostResponseRate: __DEV__ ? 0.04 : 0.02,
  startBalanceCents: dollars(5_000),
  topUpAmountCents: dollars(1_000),
  sellBackRatio: 0.8,
  tradeUp: { houseEdge: 0.1, maxChance: 0.75, maxStakeItems: 10 },
  shippingStepMs: 45_000,
  feedIntervalMs: 7_000,
};
