import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ApiError, isApiError, uuid } from '@core/common';
import type { KeyValueStore } from '@core/shared/persistence/keyValueStore';
import { createZustandStorage } from '@core/shared/persistence/zustandStorage';
import { applyOpenBoxResult, openBoxRequest } from '../api/openBox';
import {
  initialOpeningState,
  openingTransition,
  toPendingReveal,
  type OpeningEvent,
  type OpeningState,
  type PendingReveal,
} from '../machine';
import type { QueryClient } from '@tanstack/react-query';
import type { OpenBoxResponse } from '@core/shared/api';
import type { OwnedWatch } from '@core/modules/collection/types';

export type OpeningStoreDeps = {
  storage: KeyValueStore;
  queryClient: QueryClient;
  request?: (boxId: string, key: string, count: number, signal: AbortSignal) => Promise<OpenBoxResponse>;
  /** Transparent retries with the same idempotency key before surfacing an error. */
  autoRetries?: number;
  retryDelayMs?: (attempt: number) => number;
};

export type OpeningStore = {
  machine: OpeningState;
  /** Persisted mirror of `ready | opening`, the only thing the client stores. */
  pendingReveal: PendingReveal | null;
  send: (event: OpeningEvent) => OpeningState;
  /** inspecting → purchasing → ready | error. `count` boxes in one atomic payment. */
  purchase: (count?: number) => Promise<void>;
  /** error(network) → purchasing with the same idempotency key */
  retry: () => Promise<void>;
};

export function createOpeningStore(deps: OpeningStoreDeps) {
  const request = deps.request ?? openBoxRequest;
  const autoRetries = deps.autoRetries ?? 2;
  const retryDelayMs = deps.retryDelayMs ?? ((attempt: number) => 500 * 2 ** attempt);
  let controller: AbortController | null = null;

  return create<OpeningStore>()(
    persist(
      (set, get) => {
        const send = (event: OpeningEvent) => {
          const prev = get().machine;
          const next = openingTransition(prev, event);
          if (next !== prev) {
            set({ machine: next, pendingReveal: toPendingReveal(next) });
            if (event.type === 'EXIT') {
              controller?.abort();
              controller = null;
            }
          }
          return next;
        };

        const run = async (boxId: string, count: number, key: string) => {
          controller?.abort();
          const own = new AbortController();
          controller = own;
          for (let attempt = 0; ; attempt++) {
            try {
              const response = await request(boxId, key, count, own.signal);
              applyOpenBoxResult(deps.queryClient, boxId, response);
              send({ type: 'PURCHASE_SUCCEEDED', idempotencyKey: key, results: response.items });
              return;
            } catch (error) {
              if (own.signal.aborted || isApiError(error, 'aborted')) {
                return;
              }
              const retriable = isApiError(error, 'network') && attempt < autoRetries;
              if (retriable) {
                await new Promise<void>(resolve => setTimeout(() => resolve(), retryDelayMs(attempt)));
                if (own.signal.aborted) {
                  return;
                }
                continue;
              }
              const reason = isApiError(error, 'insufficient_funds') ? 'funds' : 'network';
              if (!(error instanceof ApiError)) {
                console.warn('[opening] unexpected purchase error', error);
              }
              send({ type: 'PURCHASE_FAILED', idempotencyKey: key, reason });
              return;
            }
          }
        };

        return {
          machine: initialOpeningState,
          pendingReveal: null,
          send,
          purchase: async (count = 1) => {
            const key = uuid();
            const next = send({ type: 'PURCHASE', idempotencyKey: key, count });
            if (next.status === 'purchasing') {
              await run(next.boxId, next.count, next.idempotencyKey);
            }
          },
          retry: async () => {
            const next = send({ type: 'RETRY' });
            if (next.status === 'purchasing') {
              await run(next.boxId, next.count, next.idempotencyKey);
            }
          },
        };
      },
      {
        name: 'opening',
        // v2: pendingReveal holds `results[]` instead of a single `result`.
        version: 2,
        migrate: (persisted, version) => {
          const old = persisted as { pendingReveal?: { boxId: string; result?: OwnedWatch } | null };
          if (version < 2 && old.pendingReveal?.result) {
            return { pendingReveal: { boxId: old.pendingReveal.boxId, results: [old.pendingReveal.result] } };
          }
          return persisted as Pick<OpeningStore, 'pendingReveal'>;
        },
        storage: createZustandStorage(deps.storage),
        partialize: state => ({ pendingReveal: state.pendingReveal }),
      },
    ),
  );
}

export type OpeningStoreHook = ReturnType<typeof createOpeningStore>;
