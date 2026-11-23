import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { colors, radii, spacing, Text } from '@core/design-system';
import type { Toast } from './overlayStore';

const KIND_COLOR = { info: colors.text, success: colors.success, error: colors.danger };

export function ToastView({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDone(toast.id), 3200);
    return () => clearTimeout(t);
  }, [toast.id, onDone]);

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(18)}
      exiting={FadeOutUp.duration(180)}
      layout={LinearTransition}
      accessibilityLiveRegion="polite"
      style={[styles.toast, { borderColor: KIND_COLOR[toast.kind] + '55' }]}
    >
      <Text variant="bodyStrong" color={KIND_COLOR[toast.kind]}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
