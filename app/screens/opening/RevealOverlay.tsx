import React, { useEffect } from 'react';
import { Image, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { rarityColors } from '@core/design-system';
import { watchImage, type Watch } from '@core/modules/catalog';
import { Glow } from '@app/components/Glow';

/**
 * The watch is 2D, so it lives in an RN layer above the 3D scene. Its rise is
 * tied to the lid: it emerges from the cushion while the lid swings open, then
 * pops once the reveal is confirmed.
 *
 * In a multi-open the lid stays up; each next pull is mounted with
 * `entrance` and rises out of the box on its own timer instead.
 */
export function RevealOverlay({
  watch,
  lid,
  revealed,
  entrance = false,
}: {
  watch: Watch;
  lid: SharedValue<number>;
  revealed: boolean;
  entrance?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const imageHeight = Math.min(height * 0.36, 340);
  const color = rarityColors[watch.rarity];
  const pop = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const enter = useSharedValue(entrance ? 0 : 1);

  useEffect(() => {
    if (entrance) {
      enter.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
    }
  }, [entrance, enter]);

  useEffect(() => {
    if (revealed) {
      pop.value = withSequence(withTiming(1, { duration: 180 }), withSpring(0.6, { damping: 9, stiffness: 140 }));
      shimmer.value = withDelay(
        300,
        withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true),
      );
    } else {
      pop.value = withTiming(0, { duration: 150 });
      shimmer.value = 0;
    }
  }, [revealed, pop, shimmer]);

  const watchStyle = useAnimatedStyle(() => {
    const rise = Math.min(interpolate(lid.value, [0.4, 1], [0, 1], 'clamp'), enter.value);
    return {
      opacity: interpolate(rise, [0, 0.25], [0, 1], 'clamp'),
      transform: [
        { translateY: interpolate(rise, [0, 1], [imageHeight * 0.35, -imageHeight * 0.18]) - pop.value * 16 },
        { scale: interpolate(rise, [0, 1], [0.45, 0.92]) + pop.value * 0.08 },
        { rotateZ: `${interpolate(rise, [0, 1], [-8, 0])}deg` },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    const rise = Math.min(interpolate(lid.value, [0.5, 1], [0, 1], 'clamp'), enter.value);
    return {
      opacity: rise * (0.75 + shimmer.value * 0.25),
      transform: [{ scale: 0.6 + rise * 0.5 + shimmer.value * 0.08 + pop.value * 0.15 }],
    };
  });

  return (
    <Animated.View exiting={FadeOut.duration(180)} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
      <Animated.View style={[styles.center, glowStyle]}>
        <Glow color={color} size={width * 1.1} intensity={0.7} />
      </Animated.View>
      <Animated.View style={watchStyle}>
        <Image
          testID="revealed-watch"
          source={watchImage(watch)}
          style={{ height: imageHeight, aspectRatio: 1019 / 1544 }}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
