import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@core/common';
import type { OpenBoxResponse } from '@core/shared/api/mockServer';
import { createMemoryStore } from '@core/shared/persistence/keyValueStore';
import { createOpeningStore } from '../store/openingStore';

jest.mock('@core/shared/api/server', () => ({ server: {} }));

const response: OpenBoxResponse = {
  items: [{ instanceId: 'i1', watchId: 'w_casio', boxId: 'b1', origin: 'box', acquiredAt: 'x', revealed: false }],
  balanceCents: 1_000,
  pityCount: 1,
};

function setup(request: jest.Mock, storage = createMemoryStore()) {
  const store = createOpeningStore({
    storage,
    queryClient: new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } }),
    request,
    autoRetries: 2,
    retryDelayMs: () => 0,
  });
  return { store, storage };
}

describe('opening store', () => {
  it('retries transient network errors with the same idempotency key', async () => {
    const request = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('network'))
      .mockResolvedValueOnce(response);
    const { store } = setup(request);

    store.getState().send({ type: 'INSPECT', boxId: 'b1' });
    await store.getState().purchase();

    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][1]).toBe(request.mock.calls[1][1]);
    expect(request.mock.calls[0][2]).toBe(1);
    expect(store.getState().machine.status).toBe('ready');
  });

  it('surfaces a network error after retries and Retry reuses the key', async () => {
    const request = jest.fn().mockRejectedValue(new ApiError('network'));
    const { store } = setup(request);
    store.getState().send({ type: 'INSPECT', boxId: 'b1' });
    await store.getState().purchase();

    const state = store.getState().machine;
    expect(state).toMatchObject({ status: 'error', reason: 'network' });
    const key = request.mock.calls[0][1];

    request.mockResolvedValueOnce(response);
    await store.getState().retry();
    expect(request.mock.calls.at(-1)?.[1]).toBe(key);
    expect(store.getState().machine.status).toBe('ready');
  });

  it('maps insufficient funds to a non-retriable error', async () => {
    const request = jest.fn().mockRejectedValue(new ApiError('insufficient_funds'));
    const { store } = setup(request);
    store.getState().send({ type: 'INSPECT', boxId: 'b1' });
    await store.getState().purchase();
    expect(request).toHaveBeenCalledTimes(1);
    expect(store.getState().machine).toMatchObject({ status: 'error', reason: 'funds' });
  });

  it('persists pendingReveal while ready and restores it after a restart', async () => {
    const storage = createMemoryStore();
    const { store } = setup(jest.fn().mockResolvedValue(response), storage);
    store.getState().send({ type: 'INSPECT', boxId: 'b1' });
    await store.getState().purchase();
    expect(store.getState().pendingReveal?.results[0].instanceId).toBe('i1');

    // "Kill" the app: a brand new store over the same storage.
    const { store: restarted } = setup(jest.fn(), storage);
    await restarted.persist.rehydrate();
    expect(restarted.getState().pendingReveal?.results[0].instanceId).toBe('i1');
    // The machine itself is not persisted; the UI resumes explicitly.
    expect(restarted.getState().machine.status).toBe('idle');
  });

  it('clears pendingReveal once revealed', async () => {
    const { store } = setup(jest.fn().mockResolvedValue(response));
    store.getState().send({ type: 'INSPECT', boxId: 'b1' });
    await store.getState().purchase();
    store.getState().send({ type: 'LID_GRABBED' });
    store.getState().send({ type: 'LID_OPENED' });
    expect(store.getState().pendingReveal).toBeNull();
  });

  it('buys several boxes in one request and keeps the count across retries', async () => {
    const request = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('network'))
      .mockResolvedValueOnce({ ...response, items: [response.items[0], { ...response.items[0], instanceId: 'i2' }] });
    const { store } = setup(request);
    store.getState().send({ type: 'INSPECT', boxId: 'b1' });
    await store.getState().purchase(2);

    expect(request.mock.calls.map(c => c[2])).toEqual([2, 2]);
    expect(store.getState().machine).toMatchObject({ status: 'ready' });
    expect(store.getState().pendingReveal?.results).toHaveLength(2);
  });

  it('migrates a v1 pendingReveal (single result) to results[]', async () => {
    const storage = createMemoryStore();
    storage.set(
      'opening',
      JSON.stringify({ state: { pendingReveal: { boxId: 'b1', result: response.items[0] } }, version: 1 }),
    );
    const { store } = setup(jest.fn(), storage);
    await store.persist.rehydrate();
    expect(store.getState().pendingReveal).toEqual({ boxId: 'b1', results: [response.items[0]] });
  });
});
