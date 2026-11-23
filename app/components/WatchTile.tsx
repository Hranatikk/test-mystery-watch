import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { formatMoney } from '@core/common';
import { colors, radii, RarityBadge, rarityColors, ScalePressable, spacing, Text, withAlpha } from '@core/design-system';
import { watchThumb, type Watch } from '@core/modules/catalog';
import { Glow } from './Glow';

export function WatchTile({
  watch,
  onPress,
  testID,
  badge,
}: {
  watch: Watch;
  onPress?: () => void;
  testID?: string;
  /** Small status pill, e.g. "In transit". */
  badge?: string;
}) {
  const color = rarityColors[watch.rarity];
  return (
    <ScalePressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${watch.brand} ${watch.name}, ${watch.rarity}, worth ${formatMoney(watch.valueCents)}`}
      style={[styles.tile, { borderColor: withAlpha(color, 0.28) }]}
    >
      <View style={styles.imageWrap}>
        <Glow color={color} size={150} intensity={0.35} />
        <Image source={watchThumb(watch)} style={styles.image} resizeMode="contain" />
        {badge ? (
          <View style={styles.badge}>
            <Text variant="overline" color={colors.text}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      <RarityBadge rarity={watch.rarity} size="sm" />
      <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.brand}>
        {watch.brand}
      </Text>
      <Text variant="bodyStrong" numberOfLines={1}>
        {watch.name}
      </Text>
      <Text variant="mono" color={colors.gold} style={styles.value}>
        {formatMoney(watch.valueCents)}
      </Text>
    </ScalePressable>
  );
}

/** Placeholder tile for items bought but not yet revealed. */
export function UnrevealedTile({ accent, boxName, onPress }: { accent: string; boxName: string; onPress: () => void }) {
  return (
    <ScalePressable
      testID="unrevealed-tile"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Unopened ${boxName} box. Tap to open`}
      style={[styles.tile, styles.unrevealed, { borderColor: withAlpha(accent, 0.5) }]}
    >
      <View style={styles.imageWrap}>
        <Glow color={accent} size={150} intensity={0.45} />
        <Text variant="display" color={accent}>
          ?
        </Text>
      </View>
      <Text variant="overline" color={accent}>
        Unopened
      </Text>
      <Text variant="bodyStrong" numberOfLines={1} style={styles.brand}>
        {boxName}
      </Text>
      <Text variant="caption" color={colors.textMuted}>
        Tap to reveal
      </Text>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    overflow: 'hidden',
  },
  unrevealed: { borderStyle: 'dashed' },
  imageWrap: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  image: { height: 140, aspectRatio: 1019 / 1544 },
  brand: { marginTop: spacing.sm },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(9,9,11,0.8)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  value: { marginTop: spacing.xs },
});
