import { QueryClient } from '@tanstack/react-query';
import { isApiError } from '@core/common';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Only transport failures are worth retrying; domain errors are final.
      retry: (failureCount, error) => isApiError(error, 'network') && failureCount < 3,
      retryDelay: attempt => Math.min(400 * 2 ** attempt, 4_000),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
