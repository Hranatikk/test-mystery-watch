/** Minimal synchronous key-value contract. MMKV satisfies it; tests use the in-memory one. */
export interface KeyValueStore {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): boolean;
}

export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const map = new Map(Object.entries(initial));
  return {
    getString: key => map.get(key),
    set: (key, value) => {
      map.set(key, value);
    },
    remove: key => map.delete(key),
  };
}
