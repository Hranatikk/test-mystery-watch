import { createMMKV } from 'react-native-mmkv';
import type { KeyValueStore } from './keyValueStore';

/**
 * Two physically separate stores:
 *  - `client`: UI preferences + pending reveal (what a real app would persist).
 *  - `server`: the mock backend's "database". The client never reads it directly.
 */
const clientMMKV = createMMKV({ id: 'mmkv-client' });
const serverMMKV = createMMKV({ id: 'mmkv-server' });

export const clientStorage: KeyValueStore = clientMMKV;
export const serverStorage: KeyValueStore = serverMMKV;
