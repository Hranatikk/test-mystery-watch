import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { isApiError } from '@core/common';
import { queryKeys, server } from '@core/shared/api';
import type { OwnedWatch, ShippingAddress } from '../types';

/**
 * @param subscribed false = read without re-rendering on cache updates; for
 * screens that only need the data once (e.g. while an animation runs).
 */
export function useCollectionQuery(options?: { subscribed?: boolean }) {
  return useQuery({
    queryKey: queryKeys.collection,
    queryFn: ({ signal }) => server.getCollection({ signal }),
    subscribed: options?.subscribed ?? true,
  });
}

export function useOwnedWatch(instanceId: string): OwnedWatch | undefined {
  const { data } = useCollectionQuery();
  return data?.find(i => i.instanceId === instanceId);
}

/**
 * Shipment status advances on the server with time; poll while a delivery is
 * in progress so the timeline moves without a manual refresh.
 */
export function useShipmentPolling(item: OwnedWatch | undefined) {
  const inTransit = item?.shipment != null && item.shipment.status !== 'delivered';
  return useQuery({
    queryKey: queryKeys.collection,
    queryFn: ({ signal }) => server.getCollection({ signal }),
    enabled: inTransit,
    refetchInterval: inTransit ? 5_000 : false,
  });
}

/** Idempotent on the server, so it is safe to retry automatically. */
export function useMarkRevealedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: string) => server.markRevealed(instanceId),
    retry: (count, error) => isApiError(error, 'network') && count < 5,
    retryDelay: attempt => Math.min(500 * 2 ** attempt, 5_000),
    onMutate: async instanceId => {
      await queryClient.cancelQueries({ queryKey: queryKeys.collection });
      queryClient.setQueryData<OwnedWatch[]>(queryKeys.collection, prev =>
        prev?.map(i => (i.instanceId === instanceId ? { ...i, revealed: true } : i)),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.collection }),
  });
}

function invalidateOwnership(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.collection });
  queryClient.invalidateQueries({ queryKey: queryKeys.balance });
  queryClient.invalidateQueries({ queryKey: queryKeys.activity });
}

export function useSellBackMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: string) => server.sellBack(instanceId),
    onSuccess: ({ balanceCents }, instanceId) => {
      queryClient.setQueryData(queryKeys.balance, balanceCents);
      queryClient.setQueryData<OwnedWatch[]>(queryKeys.collection, prev =>
        prev?.filter(i => i.instanceId !== instanceId),
      );
    },
    onSettled: () => invalidateOwnership(queryClient),
  });
}

export type ShipVariables = { instanceId: string; address: ShippingAddress; idempotencyKey: string };

/** The caller creates the key once per attempt, so automatic retries are deduped by the server. */
export function useShipMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: ShipVariables) => server.requestShipping(v.instanceId, v.address, v.idempotencyKey),
    retry: (count, error) => isApiError(error, 'network') && count < 3,
    onSuccess: item => {
      queryClient.setQueryData<OwnedWatch[]>(queryKeys.collection, prev =>
        prev?.map(i => (i.instanceId === item.instanceId ? item : i)),
      );
    },
    onSettled: () => invalidateOwnership(queryClient),
  });
}

export type TradeUpVariables = { instanceIds: string[]; targetWatchId: string; idempotencyKey: string };

export function useTradeUpMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: TradeUpVariables) => server.tradeUp(v.instanceIds, v.targetWatchId, v.idempotencyKey),
    retry: (count, error) => isApiError(error, 'network') && count < 3,
    onSuccess: res => {
      queryClient.setQueryData<OwnedWatch[]>(queryKeys.collection, prev => {
        const kept = prev?.filter(i => !res.consumedInstanceIds.includes(i.instanceId));
        return kept && res.item ? [res.item, ...kept] : kept;
      });
    },
    onSettled: () => invalidateOwnership(queryClient),
  });
}
