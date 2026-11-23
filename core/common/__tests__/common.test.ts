import { createSeededRng, formatMoney, probabilities, weightedPick } from '..';

describe('weightedPick', () => {
  it('never picks zero-weight entries', () => {
    const rng = createSeededRng(9);
    for (let i = 0; i < 500; i++) {
      expect(weightedPick([{ item: 'a', weight: 0 }, { item: 'b', weight: 1 }], rng)).toBe('b');
    }
  });

  it('throws on empty weights', () => {
    expect(() => weightedPick([{ item: 'a', weight: 0 }], Math.random)).toThrow();
  });

  it('computes probabilities', () => {
    expect(probabilities([{ item: 1, weight: 3 }, { item: 2, weight: 1 }])).toEqual([0.75, 0.25]);
  });
});

describe('formatMoney', () => {
  it('formats cents', () => {
    expect(formatMoney(14_900)).toBe('$149');
    expect(formatMoney(1_850_000)).toBe('$18,500');
    expect(formatMoney(1_999)).toBe('$19.99');
  });
});
