import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { OverlayHost, useOverlayStore } from '@core/overlays';
import { server } from '@core/shared/api/server';
import { useOpeningStore } from '@stores/openingStore';
import { queryClient } from '@stores/queryClient';
import { useSettingsStore } from '@stores/settingsStore';

const mockConfig: { startBalanceCents: number } = require('@core/shared/api/server').testConfig;
import { OpeningScreen } from '../OpeningScreen';

jest.mock('@core/shared/api/server', () => {
  const { MockServer } = require('@core/shared/api/mockServer');
  const { createMemoryStore } = require('@core/shared/persistence/keyValueStore');
  const { createSeededRng } = require('@core/common');
  const config = {
    latencyMs: [0, 0],
    failRate: 0,
    lostResponseRate: 0,
    startBalanceCents: 100_000,
    topUpAmountCents: 100_000,
    sellBackRatio: 0.8,
    tradeUp: { houseEdge: 0.1, maxChance: 0.75, maxStakeItems: 10 },
    shippingStepMs: 60_000,
    feedIntervalMs: 5_000,
  };
  return {
    testConfig: config,
    server: new MockServer({
      storage: createMemoryStore(),
      config,
      rng: createSeededRng(1),
      chaosRng: () => 0.99,
      sleep: async () => undefined,
    }),
  };
});

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  usePreventRemove: jest.fn(),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

function renderOpening() {
  // The opening store writes purchase results into the app-wide client, so the
  // screen must read from the same one.
  const navigation = { setOptions: jest.fn(), goBack: jest.fn(), navigate: jest.fn() };
  const route = { key: 'Opening-1', name: 'Opening' as const, params: { boxId: 'b_icy' } };
  render(
    <QueryClientProvider client={queryClient}>
      <OpeningScreen navigation={navigation as never} route={route} />
      <OverlayHost />
    </QueryClientProvider>,
  );
  return { navigation };
}

beforeAll(() => {
  // gcTime Infinity schedules no garbage-collection timers, which would
  // otherwise keep Jest alive for 5 minutes after the run.
  const defaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    queries: { ...defaults.queries, gcTime: Infinity },
    mutations: { ...defaults.mutations, gcTime: Infinity },
  });
});

afterEach(() => {
  // Unmount first: observers unsubscribing schedule gc timers (5 min by
  // default) that would otherwise keep Jest alive after clear().
  cleanup();
  queryClient.clear();
});

beforeEach(() => {
  server.reset();
  useOverlayStore.setState({ sheet: null, toasts: [] });
  useOpeningStore.setState({ machine: { status: 'idle' }, pendingReveal: null });
  // Coach marks are covered separately; keep these flows focused.
  useSettingsStore.setState({ onboarding: { welcome: true, spin: true, lid: true } });
});

describe('OpeningScreen purchase flow', () => {

  it('buys a box after confirmation, debits the balance and unlocks the lid', async () => {
    mockConfig.startBalanceCents = 100_000;
    const { navigation } = renderOpening();

    fireEvent.press(await screen.findByTestId('opening-buy'));
    fireEvent.press(await screen.findByTestId('confirm-purchase'));

    expect(await screen.findByText('Swipe up to lift the lid')).toBeTruthy();
    expect(await server.getBalance()).toBe(100_000 - 14_900);
    expect(await screen.findByText('$851')).toBeTruthy();

    const state = useOpeningStore.getState();
    expect(state.machine.status).toBe('ready');
    // Paid but unrevealed → survives an app kill.
    expect(state.pendingReveal?.boxId).toBe('b_icy');
    expect((await server.getCollection())[0]).toMatchObject({ boxId: 'b_icy', revealed: false });
    // Swipe-back stays enabled in `ready`, it was disabled while purchasing.
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
  });

  it('shows the top up sheet instead of charging when funds are insufficient', async () => {
    mockConfig.startBalanceCents = 5_000;
    renderOpening();

    await waitFor(() => expect(screen.getByText('$50')).toBeTruthy());
    fireEvent.press(screen.getByTestId('opening-buy'));

    expect(await screen.findByText('Not enough balance')).toBeTruthy();
    expect(screen.queryByTestId('confirm-purchase')).toBeNull();

    // Topping up from the sheet continues to confirmation.
    await act(async () => {
      fireEvent.press(screen.getByTestId('top-up'));
    });
    expect(await screen.findByTestId('confirm-purchase')).toBeTruthy();
    expect(await server.getBalance()).toBe(105_000);
    expect(useOpeningStore.getState().machine.status).toBe('inspecting');
  });

  it('opens three at once, reveals them one by one and sells the commons from the summary', async () => {
    mockConfig.startBalanceCents = 100_000;
    renderOpening();

    fireEvent.press(await screen.findByTestId('quantity-3'));
    expect(screen.getByText('Buy 3 & open')).toBeTruthy();
    fireEvent.press(screen.getByTestId('opening-buy'));
    fireEvent.press(await screen.findByTestId('confirm-purchase'));

    expect(await screen.findByText('3 watches inside · the best one comes last')).toBeTruthy();
    expect(await server.getBalance()).toBe(100_000 - 3 * 14_900);
    expect(useOpeningStore.getState().pendingReveal?.results).toHaveLength(3);

    await act(async () => {
      fireEvent.press(screen.getByTestId('opening-open-for-me'));
    });
    expect(await screen.findByText('1 of 3')).toBeTruthy();
    // Pulls 2 and 3 are still unseen and must survive an app kill.
    expect(useOpeningStore.getState().pendingReveal?.results).toHaveLength(2);

    fireEvent.press(screen.getByTestId('opening-next'));
    expect(await screen.findByText('2 of 3')).toBeTruthy();
    fireEvent.press(screen.getByTestId('opening-next'));
    expect(await screen.findByText('See all 3')).toBeTruthy();
    fireEvent.press(screen.getByTestId('opening-next'));

    expect(await screen.findByTestId('summary-card')).toBeTruthy();
    expect(useOpeningStore.getState().pendingReveal).toBeNull();

    const commons = (await server.getCollection()).filter(i => i.watchId === 'w_casio').length;
    if (commons > 1) {
      await act(async () => {
        fireEvent.press(screen.getByTestId('summary-sell-commons'));
      });
      await waitFor(async () =>
        expect((await server.getCollection()).filter(i => i.watchId === 'w_casio')).toHaveLength(0),
      );
    }
    const activity = await server.getActivity();
    expect(activity.find(a => a.kind === 'open')).toMatchObject({ count: 3, amountCents: -3 * 14_900 });
  });
});
