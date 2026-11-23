import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, Icon, spacing, Text } from '@core/design-system';

export function SwipeHint({ color }: { color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 700, easing: Easing.in(Easing.quad) }),
      ),
      -1,
    );
  }, [t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -t.value * 10 }],
    opacity: 0.55 + t.value * 0.45,
  }));
  return (
    <View style={styles.wrap} accessibilityRole="text" accessibilityLabel="Swipe up on the box to open the lid">
      <Animated.View style={[styles.chevrons, style]}>
        <Icon name="chevronUp" size={18} color={color} />
        <View style={styles.overlap}>
          <Icon name="chevronUp" size={18} color={color} />
        </View>
      </Animated.View>
      <Text variant="bodyStrong">Swipe up to lift the lid</Text>
      <Text variant="caption" color={colors.textMuted}>
        Your watch is already inside.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xs },
  chevrons: { alignItems: 'center', marginBottom: spacing.xs },
  overlap: { marginTop: -10 },
});
