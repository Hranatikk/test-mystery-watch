/* eslint-disable no-bitwise */
/** A source of uniformly distributed numbers in [0, 1). */
export type Rng = () => number;

/**
 * Small, fast, seedable PRNG (mulberry32). Used so that the mock server can be
 * made deterministic in tests while still using Math.random in the app.
 */
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const defaultRng: Rng = Math.random;
