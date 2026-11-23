export type TradeUpRules = { houseEdge: number; maxChance: number; maxStakeItems: number };

/**
 * Win chance of a trade-up. Shared by the server (which rolls) and the UI
 * (which shows the number before the user commits), so they always agree.
 */
export function tradeUpChance(stakeCents: number, targetCents: number, rules: TradeUpRules): number {
  if (stakeCents <= 0 || targetCents <= stakeCents) {
    return 0;
  }
  return Math.min(rules.maxChance, (stakeCents * (1 - rules.houseEdge)) / targetCents);
}
