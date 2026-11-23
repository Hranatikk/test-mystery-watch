/**
 * Query keys act as the "tags" for cache invalidation (RTK Query tags equivalent).
 */
export const queryKeys = {
  boxes: ['catalog', 'boxes'] as const,
  box: (id: string) => ['catalog', 'box', id] as const,
  watches: ['catalog', 'watches'] as const,
  balance: ['wallet', 'balance'] as const,
  collection: ['collection'] as const,
  activity: ['activity'] as const,
  pity: ['opening', 'pity'] as const,
  feed: ['feed'] as const,
};
