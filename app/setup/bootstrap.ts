import { queryKeys, server } from '@core/shared/api';
import { configureHaptics } from '@core/shared/haptics';
import { configureSound } from '@core/shared/sound';
import { queryClient, useOpeningStore, useSettingsStore, useWishlistStore } from '@stores/index';

/**
 * Runs once before the first screen renders:
 *  - waits for persisted client state (MMKV is synchronous, so this is instant),
 *  - wires preferences into infrastructure,
 *  - warms the server cache (catalogue, balance, collection).
 *
 * The GLB itself is bundled and read from disk by each Filament engine.
 * Filament releases the source buffer right after parsing, so there is no
 * shared JS-side buffer to keep; instead the catalogue bounds how many
 * engines exist at once.
 */
export async function bootstrap(): Promise<void> {
  await Promise.all([
    useSettingsStore.persist.rehydrate(),
    useOpeningStore.persist.rehydrate(),
    useWishlistStore.persist.rehydrate(),
  ]);

  const applyPreferences = (s: ReturnType<typeof useSettingsStore.getState>) => {
    configureHaptics({ enabled: s.hapticsEnabled });
    configureSound({ enabled: s.soundEnabled });
  };
  applyPreferences(useSettingsStore.getState());
  useSettingsStore.subscribe(applyPreferences);

  const prefetch = Promise.allSettled([
    queryClient.prefetchQuery({ queryKey: queryKeys.boxes, queryFn: () => server.getBoxes() }),
    queryClient.prefetchQuery({ queryKey: queryKeys.watches, queryFn: () => server.getWatches() }),
    queryClient.prefetchQuery({ queryKey: queryKeys.balance, queryFn: () => server.getBalance() }),
    queryClient.prefetchQuery({ queryKey: queryKeys.collection, queryFn: () => server.getCollection() }),
    queryClient.prefetchQuery({ queryKey: queryKeys.pity, queryFn: () => server.getPity() }),
  ]);

  // Don't block forever on a flaky "network": screens handle their own loading states.
  await Promise.race([prefetch, new Promise<void>(resolve => setTimeout(() => resolve(), 2_500))]);
}
