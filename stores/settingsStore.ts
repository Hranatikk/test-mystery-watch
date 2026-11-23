import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ShippingAddress } from '@core/modules/collection/types';
import { clientStorage } from '@core/shared/persistence/mmkv';
import { createZustandStorage } from '@core/shared/persistence/zustandStorage';

/** One-time coach marks. A flag flips to true once the user has done the thing. */
export type OnboardingStep = 'welcome' | 'spin' | 'lid';

type SettingsState = {
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  onboarding: Record<OnboardingStep, boolean>;
  /** Prefills the delivery form next time. Stays on the device. */
  lastAddress: ShippingAddress | null;
  setHapticsEnabled: (value: boolean) => void;
  setSoundEnabled: (value: boolean) => void;
  completeOnboarding: (step: OnboardingStep) => void;
  setLastAddress: (address: ShippingAddress) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      hapticsEnabled: true,
      soundEnabled: true,
      onboarding: { welcome: false, spin: false, lid: false },
      lastAddress: null,
      setHapticsEnabled: value => set({ hapticsEnabled: value }),
      setSoundEnabled: value => set({ soundEnabled: value }),
      completeOnboarding: step => set(s => (s.onboarding[step] ? s : { onboarding: { ...s.onboarding, [step]: true } })),
      setLastAddress: address => set({ lastAddress: address }),
    }),
    {
      name: 'settings',
      version: 2,
      storage: createZustandStorage(clientStorage),
      // v1 only had hapticsEnabled; everything else falls back to defaults.
      migrate: persisted => persisted as Partial<SettingsState>,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return { ...current, ...p, onboarding: { ...current.onboarding, ...p.onboarding } };
      },
      partialize: s => ({
        hapticsEnabled: s.hapticsEnabled,
        soundEnabled: s.soundEnabled,
        onboarding: s.onboarding,
        lastAddress: s.lastAddress,
      }),
    },
  ),
);
