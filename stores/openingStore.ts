import { createOpeningStore } from '@core/modules/opening/store/openingStore';
import { clientStorage } from '@core/shared/persistence/mmkv';
import { queryClient } from './queryClient';

/** App-wide instance of the opening state machine (pendingReveal persisted in MMKV). */
export const useOpeningStore = createOpeningStore({ storage: clientStorage, queryClient });
