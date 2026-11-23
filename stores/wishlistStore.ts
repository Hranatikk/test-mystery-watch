import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clientStorage } from '@core/shared/persistence/mmkv';
import { createZustandStorage } from '@core/shared/persistence/zustandStorage';

type WishlistState = {
  /** Watch ids, most recently added first. */
  watchIds: string[];
  toggle: (watchId: string) => boolean;
};

/**
 * A personal preference rather than server data, so it lives on the device
 * (MMKV), like the user's settings.
 */
export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      watchIds: [],
      toggle: watchId => {
        const has = get().watchIds.includes(watchId);
        set(s => ({ watchIds: has ? s.watchIds.filter(id => id !== watchId) : [watchId, ...s.watchIds] }));
        return !has;
      },
    }),
    {
      name: 'wishlist',
      version: 1,
      storage: createZustandStorage(clientStorage),
      partialize: s => ({ watchIds: s.watchIds }),
    },
  ),
);

export function useIsWishlisted(watchId: string): boolean {
  return useWishlistStore(s => s.watchIds.includes(watchId));
}
