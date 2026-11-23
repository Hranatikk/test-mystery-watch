import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, server } from '@core/shared/api';

export function useBalanceQuery() {
  return useQuery({
    queryKey: queryKeys.balance,
    queryFn: ({ signal }) => server.getBalance({ signal }),
  });
}

export function useTopUpMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => server.topUp(),
    onSuccess: balance => queryClient.setQueryData(queryKeys.balance, balance),
    onError: () => queryClient.invalidateQueries({ queryKey: queryKeys.balance }),
  });
}
