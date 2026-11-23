import { mockApiConfig } from '@app/config/api';
import { serverStorage } from '@core/shared/persistence/mmkv';
import { MockServer } from './mockServer';

/** App-wide fake backend instance, persisted in its own MMKV store. */
export const server = new MockServer({ storage: serverStorage, config: mockApiConfig });
