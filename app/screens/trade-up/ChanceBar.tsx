import React, { useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, radii, spacing, Text, withAlpha } from '@core/design-system';
import { playSound } from '@core/shared/sound';

export type ChanceBarHandle = {
  /** Sweep while waiting for the server. */
  spin: () => void;
  /** Land the needle on the server's roll; resolves when it stops. */
  land: (roll: number) => Promise<void>;
  reset: () => void;
};

/**
 * The win zone is the left `chance` share of the bar. The needle sweeps back
 * and forth (triangle wave over `v`) and lands exactly on the server's roll,
 * so what the user sees is the real outcome, not a decoration.
 */
export const ChanceBar = forwardRef<ChanceBarHandle, { chance: number; accent: string }>(function ChanceBarView(
  { chance, accent },
  ref,
) {
  const [width, setWidth] = useState(0);
  const v = useSharedValue(0);

  useImperativeHandle(
    ref,
    () => ({
      spin: () => {
        cancelAnimation(v);
        v.value = 0;
        v.value = withTiming(40, { duration: 40_000, easing: Easing.linear });
      },
      land: roll =>
        new Promise<void>(resolve => {
          const current = v.value;
          cancelAnimation(v);
          // Next even number (needle at 0, moving right) + two full sweeps + roll.
          const base = Math.ceil(current / 2) * 2 + 4;
          v.value = withTiming(base + roll, { duration: 2_200, easing: Easing.out(Easing.cubic) }, finished => {
            if (finished) {
              runOnJS(resolve)();
            }
          });
        }),
      reset: () => {
        cancelAnimation(v);
        v.value = withTiming(0, { duration: 250 });
      },
    }),
    [v],
  );

  useEffect(() => () => cancelAnimation(v), [v]);

  // A tick each time the needle crosses a tenth of the bar.
  useAnimatedReaction(
    () => Math.floor(v.value * 10),
    (step, prev) => {
      if (prev != null && step !== prev && v.value > 0.05) {
        runOnJS(playSound)('tick', 0.35);
      }
    },
  );

  const needle = useAnimatedStyle(() => {
    const p = v.value % 2;
    const pos = p < 1 ? p : 2 - p;
    return { transform: [{ translateX: pos * width - 1.5 }] };
  });

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.wrap}>
      <View style={styles.labels}>
        <Text variant="overline" color={accent}>
          Win {(chance * 100).toFixed(1)}%
        </Text>
        <Text variant="overline" color={colors.textFaint}>
          Miss {((1 - chance) * 100).toFixed(1)}%
        </Text>
      </View>
      <View style={styles.track} onLayout={onLayout} testID="chance-bar">
        <View style={[styles.win, { width: `${chance * 100}%`, backgroundColor: withAlpha(accent, 0.55) }]} />
        <Animated.View style={[styles.needle, needle]} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  track: {
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  win: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  needle: { position: 'absolute', top: 0, bottom: 0, width: 3, backgroundColor: colors.text, borderRadius: 2 },
});
