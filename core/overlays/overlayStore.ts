import type { ReactNode } from 'react';
import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';
export type Toast = { id: number; message: string; kind: ToastKind };

export type SheetSpec = {
  key: string;
  render: (close: () => void) => ReactNode;
  /** When false, backdrop taps / back button do not close the sheet. */
  dismissible?: boolean;
  onDismiss?: () => void;
};

type OverlayState = {
  sheet: SheetSpec | null;
  toasts: Toast[];
  showSheet: (sheet: SheetSpec) => void;
  hideSheet: () => void;
  showToast: (message: string, kind?: ToastKind) => void;
  dismissToast: (id: number) => void;
};

let toastId = 0;

export const useOverlayStore = create<OverlayState>()(set => ({
  sheet: null,
  toasts: [],
  showSheet: sheet => set({ sheet }),
  hideSheet: () => set({ sheet: null }),
  showToast: (message, kind = 'info') =>
    set(s => ({ toasts: [...s.toasts.slice(-2), { id: ++toastId, message, kind }] })),
  dismissToast: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

/** Imperative helpers usable outside React (stores, callbacks). */
export const toast = {
  info: (message: string) => useOverlayStore.getState().showToast(message, 'info'),
  success: (message: string) => useOverlayStore.getState().showToast(message, 'success'),
  error: (message: string) => useOverlayStore.getState().showToast(message, 'error'),
};
