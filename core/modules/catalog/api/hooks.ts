import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, server } from '@core/shared/api';
import type { Box, Watch } from '../types';

export function useBoxesQuery() {
  return useQuery({
    queryKey: queryKeys.boxes,
    queryFn: ({ signal }) => server.getBoxes({ signal }),
    staleTime: Infinity,
  });
}

export function useBoxQuery(boxId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.box(boxId),
    queryFn: ({ signal }) => server.getBox(boxId, { signal }),
    staleTime: Infinity,
    // The list already holds every box, so details render instantly.
    initialData: () => queryClient.getQueryData<Box[]>(queryKeys.boxes)?.find(b => b.id === boxId),
  });
}

export function useWatchesQuery() {
  return useQuery({
    queryKey: queryKeys.watches,
    queryFn: ({ signal }) => server.getWatches({ signal }),
    staleTime: Infinity,
  });
}

export function useWatchesById(): Record<string, Watch> | undefined {
  const { data } = useWatchesQuery();
  return useMemo(
    () => (data ? Object.fromEntries(data.map(w => [w.id, w])) : undefined),
    [data],
  );
}
