import type { QueryClient } from '@tanstack/react-query';
import { queryKeys, server, type OpenBoxResponse } from '@core/shared/api';
import type { OwnedWatch } from '@core/modules/collection/types';

export function openBoxRequest(boxId: string, idempotencyKey: string, count: number, signal?: AbortSignal) {
  return server.openBox(boxId, idempotencyKey, { signal, count });
}

/** Instant cache write for everything a purchase touches, then a background refetch. */
export function applyOpenBoxResult(queryClient: QueryClient, boxId: string, response: OpenBoxResponse) {
  queryClient.setQueryData(queryKeys.balance, response.balanceCents);
  queryClient.setQueryData<OwnedWatch[]>(queryKeys.collection, prev => {
    if (!prev) {
      return prev;
    }
    const known = new Set(prev.map(i => i.instanceId));
    return [...response.items.filter(i => !known.has(i.instanceId)), ...prev];
  });
  queryClient.setQueryData<Record<string, number>>(queryKeys.pity, prev => ({ ...prev, [boxId]: response.pityCount }));
  for (const key of [queryKeys.balance, queryKeys.collection, queryKeys.pity, queryKeys.activity, queryKeys.feed]) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}
