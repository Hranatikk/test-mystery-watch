import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@core/design-system';
import { BottomSheet } from './BottomSheet';
import { ToastView } from './ToastView';
import { useOverlayStore, type SheetSpec } from './overlayStore';

/** Renders the current sheet and toasts above the whole navigation tree. */
export function OverlayHost() {
  const sheet = useOverlayStore(s => s.sheet);
  const hideSheet = useOverlayStore(s => s.hideSheet);
  const toasts = useOverlayStore(s => s.toasts);
  const dismissToast = useOverlayStore(s => s.dismissToast);
  const insets = useSafeAreaInsets();

  // Keep the last sheet mounted while it animates out.
  const [rendered, setRendered] = useState<SheetSpec | null>(sheet);
  useEffect(() => {
    if (sheet) {
      setRendered(sheet);
    }
  }, [sheet]);

  // Backdrop tap, swipe down or hardware back = user dismissal.
  const dismiss = useCallback(() => {
    const current = useOverlayStore.getState().sheet;
    hideSheet();
    current?.onDismiss?.();
  }, [hideSheet]);

  const onClosed = useCallback(() => {
    if (!useOverlayStore.getState().sheet) {
      setRendered(null);
    }
  }, []);

  return (
    <>
      {rendered ? (
        <BottomSheet
          key={rendered.key}
          visible={sheet != null && sheet.key === rendered.key}
          dismissible={rendered.dismissible !== false}
          onRequestClose={dismiss}
          onClosed={onClosed}
        >
          {rendered.render(hideSheet)}
        </BottomSheet>
      ) : null}
      <View pointerEvents="box-none" style={[styles.toasts, { top: insets.top + spacing.sm }]}>
        {toasts.map(t => (
          <ToastView key={t.id} toast={t} onDone={dismissToast} />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  toasts: { position: 'absolute', left: spacing.lg, right: spacing.lg },
});
