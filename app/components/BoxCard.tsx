import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatMoney } from '@core/common';
import { colors, radii, ScalePressable, spacing, Text, withAlpha } from '@core/design-system';
import type { Box } from '@core/modules/catalog';
import { BoxView } from '@core/scene';
import { useWishlistStore } from '@stores/wishlistStore';
import { Glow } from './Glow';

export type BoxCardProps = {
  box: Box;
  width: number;
  height: number;
  /** Mount the live 3D view at all (bounded by the pager window). */
  mount3D: boolean;
  /** Render gate: visible + focused screen. */
  active: boolean;
  /** Stable callback (receives the id) so memo can skip re-renders while paging. */
  onPress: (boxId: string) => void;
};

export const BoxCard = memo(function BoxCard({ box, width, height, mount3D, active, onPress }: BoxCardProps) {
  const { theme } = box;
  const wished = useWishlistStore(s => s.watchIds);
  const wishedInside = box.contents.filter(c => wished.includes(c.watchId)).length;
  return (
    <ScalePressable
      testID={`box-card-${box.id}`}
      onPress={() => onPress(box.id)}
      accessibilityRole="button"
      accessibilityLabel={`${box.name} box, ${formatMoney(box.priceCents)}`}
      style={[
        styles.card,
        {
          width,
          height,
          backgroundColor: theme.backdrop,
          borderColor: withAlpha(theme.accent, 0.25),
          experimental_backgroundImage: `linear-gradient(180deg, ${withAlpha(theme.accent, 0.18)} 0%, ${withAlpha(theme.backdrop, 0)} 60%)`,
        },
      ]}
    >
      <View style={styles.stage}>
        <Glow color={theme.accent} size={width * 1.05} intensity={0.32} />
        {mount3D ? (
          <BoxView theme={theme} autoRotate active={active} style={StyleSheet.absoluteFill} margin={1.45} />
        ) : null}
        {wishedInside ? (
          <View style={styles.wishBadge} testID={`box-wish-${box.id}`}>
            <Text variant="caption" color="#ff6b8a">
              ♥ {wishedInside} from your wishlist
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.footer}>
        <View style={styles.titleCol}>
          <Text variant="title" numberOfLines={1}>
            {box.name}
          </Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={2}>
            {box.tagline}
          </Text>
        </View>
        <View style={[styles.price, { backgroundColor: withAlpha(theme.accent, 0.16), borderColor: withAlpha(theme.accent, 0.4) }]}>
          <Text variant="mono" color={theme.accent}>
            {formatMoney(box.priceCents)}
          </Text>
        </View>
      </View>
    </ScalePressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    padding: spacing.xl,
    paddingTop: spacing.md,
  },
  titleCol: { flex: 1, gap: spacing.xs },
  wishBadge: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(9,9,11,0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,107,138,0.45)',
  },
  price: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
