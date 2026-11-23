import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { formatMoney } from '@core/common';
import { colors, radii, RarityBadge, rarityColors, spacing, Text, withAlpha } from '@core/design-system';
import { formatProbability, watchThumb, type BoxOdd } from '@core/modules/catalog';
import { WishlistButton } from './WishlistButton';

export function OddsList({ odds }: { odds: BoxOdd[] }) {
  return (
    <View style={styles.list}>
      {odds.map(({ watch, probability }) => {
        const color = rarityColors[watch.rarity];
        return (
          <View
            key={watch.id}
            style={styles.row}
            accessible
            accessibilityLabel={`${watch.brand} ${watch.name}, ${formatProbability(probability)} chance, worth ${formatMoney(watch.valueCents)}`}
          >
            <View style={[styles.thumb, { backgroundColor: withAlpha(color, 0.1) }]}>
              <Image source={watchThumb(watch)} style={styles.image} resizeMode="contain" />
            </View>
            <View style={styles.info}>
              <RarityBadge rarity={watch.rarity} size="sm" />
              <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
                {watch.brand} {watch.name}
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                {formatMoney(watch.valueCents)}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { backgroundColor: color, width: `${Math.max(1.5, probability * 100)}%` },
                  ]}
                />
              </View>
            </View>
            <View style={styles.side}>
              <Text variant="mono" color={color} style={styles.pct}>
                {formatProbability(probability)}
              </Text>
              <WishlistButton watchId={watch.id} label={watch.name} size="sm" />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  thumb: {
    width: 64,
    height: 72,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { height: 64, aspectRatio: 1019 / 1544 },
  info: { flex: 1, gap: 2 },
  name: { marginTop: 4 },
  barTrack: {
    marginTop: spacing.xs,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  barFill: { height: 4, borderRadius: 2 },
  side: { alignItems: 'flex-end', gap: spacing.sm },
  pct: { minWidth: 58, textAlign: 'right' },
});
