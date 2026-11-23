import React from 'react';
import { StyleSheet, View } from 'react-native';
import { RARITY_LABEL, type Rarity } from '@core/common';
import { radii, rarityColors, spacing, withAlpha } from '../theme';
import { Text } from './Text';

export function RarityBadge({ rarity, size = 'md' }: { rarity: Rarity; size?: 'sm' | 'md' }) {
  const color = rarityColors[rarity];
  return (
    <View
      style={[
        styles.badge,
        size === 'sm' && styles.small,
        { backgroundColor: withAlpha(color, 0.14), borderColor: withAlpha(color, 0.4) },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text variant="overline" color={color} style={size === 'sm' ? styles.smallText : undefined}>
        {RARITY_LABEL[rarity]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  small: { paddingHorizontal: 6, paddingVertical: 2 },
  smallText: { fontSize: 9, letterSpacing: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
