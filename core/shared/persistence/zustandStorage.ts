import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { KeyValueStore } from './keyValueStore';

export function createZustandStorage(store: KeyValueStore) {
  const adapter: StateStorage = {
    getItem: name => store.getString(name) ?? null,
    setItem: (name, value) => store.set(name, value),
    removeItem: name => {
      store.remove(name);
    },
  };
  return createJSONStorage(() => adapter);
}
