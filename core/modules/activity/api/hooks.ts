import { useQuery } from '@tanstack/react-query';
import { queryKeys, server } from '@core/shared/api';

export function useActivityQuery() {
  return useQuery({
    queryKey: queryKeys.activity,
    queryFn: ({ signal }) => server.getActivity({ signal }),
  });
}

export function usePityQuery() {
  return useQuery({
    queryKey: queryKeys.pity,
    queryFn: ({ signal }) => server.getPity({ signal }),
  });
}

/** Polled like a websocket substitute; paused when the screen isn't focused. */
export function useFeedQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.feed,
    queryFn: ({ signal }) => server.getFeed({ signal }),
    enabled,
    refetchInterval: enabled ? 6_000 : false,
    // A failed poll keeps showing the last good list.
    retry: false,
    staleTime: 0,
  });
}
