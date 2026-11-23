import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, radii, spacing, Text } from '@core/design-system';

/**
 * One-time interactive hint. It never blocks touches: the user performs the
 * real gesture on the 3D stage underneath, and that is what dismisses it.
 */
export function CoachMark({ kind, label, accent }: { kind: 'dragX' | 'swipeUp'; label: string; accent: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
    );
  }, [t]);

  const finger = useAnimatedStyle(() => {
    const p = t.value;
    const fade = p < 0.1 ? p / 0.1 : p > 0.85 ? (1 - p) / 0.15 : 1;
    return kind === 'dragX'
      ? { opacity: fade, transform: [{ translateX: -70 + p * 140 }] }
      : { opacity: fade, transform: [{ translateY: 40 - p * 110 }] };
  });

  return (
    <Animated.View
      entering={FadeIn.delay(400).duration(300)}
      exiting={FadeOut.duration(200)}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.center]}
      testID={`coach-${kind}`}
    >
      <View style={styles.track}>
        <Animated.View style={[styles.finger, { borderColor: accent }, finger]}>
          <View style={[styles.fingerDot, { backgroundColor: accent }]} />
        </Animated.View>
      </View>
      <View style={styles.bubble}>
        <Text variant="bodyStrong" align="center">
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  track: { width: 200, height: 160, alignItems: 'center', justifyContent: 'center' },
  finger: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  fingerDot: { width: 14, height: 14, borderRadius: 7 },
  bubble: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(9,9,11,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
});
