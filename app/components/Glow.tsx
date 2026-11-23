import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { withAlpha } from '@core/design-system';

/** Soft radial light, used behind 3D boxes and revealed watches. */
export function Glow({
  color,
  size,
  intensity = 0.55,
  style,
}: {
  color: string;
  size: number;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.glow,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          experimental_backgroundImage: `radial-gradient(circle at center, ${withAlpha(color, intensity)} 0%, ${withAlpha(color, intensity * 0.35)} 35%, ${withAlpha(color, 0)} 70%)`,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute' },
});
