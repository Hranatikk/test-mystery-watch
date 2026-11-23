import React, { forwardRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Share from 'react-native-share';
import { formatMoney, RARITY_LABEL } from '@core/common';
import { colors, radii, rarityColors, spacing, Text, withAlpha } from '@core/design-system';
import { watchImage, type Watch } from '@core/modules/catalog';
import { Glow } from './Glow';

const CARD_WIDTH = 360;

type Props = { watch: Watch; boxName?: string | null };

/**
 * Rendered off-screen and captured to a PNG on demand. A fixed size keeps the
 * shared image identical across devices.
 */
export const ShareCard = forwardRef<View, Props>(function ShareCardView({ watch, boxName }, ref) {
  const color = rarityColors[watch.rarity];
  return (
    <View pointerEvents="none" style={styles.offscreen}>
      <View
        ref={ref}
        collapsable={false}
        style={[
          styles.card,
          {
            borderColor: withAlpha(color, 0.5),
            experimental_backgroundImage: `linear-gradient(180deg, ${withAlpha(color, 0.28)} 0%, ${colors.background} 70%)`,
          },
        ]}
      >
        <Text variant="overline" color={withAlpha(color, 0.95)}>
          {RARITY_LABEL[watch.rarity]} pull
        </Text>
        <View style={styles.hero}>
          <Glow color={color} size={CARD_WIDTH} intensity={0.6} />
          <Image source={watchImage(watch)} style={styles.image} resizeMode="contain" />
        </View>
        <Text variant="caption" color={colors.textMuted}>
          {watch.brand} · Ref. {watch.reference}
        </Text>
        <Text variant="title">{watch.name}</Text>
        <Text variant="mono" color={colors.gold} style={styles.value}>
          {formatMoney(watch.valueCents)}
        </Text>
        <View style={styles.footer}>
          <Text variant="caption" color={colors.textFaint}>
            {boxName ? `Pulled from ${boxName}` : 'Won in a trade-up'}
          </Text>
          <Text variant="overline" color={colors.gold}>
            Mystery Watch
          </Text>
        </View>
      </View>
    </View>
  );
});

/** Captures the card and opens the system share sheet. Resolves false if the user cancelled or it failed. */
export async function shareCard(ref: React.RefObject<View | null>, watch: Watch): Promise<boolean> {
  if (!ref.current) {
    return false;
  }
  try {
    const path = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
    const url = path.startsWith('file://') ? path : `file://${path}`;
    const res = await Share.open({
      url,
      type: 'image/png',
      message: `I just pulled a ${watch.brand} ${watch.name} on Mystery Watch`,
      failOnCancel: false,
    });
    return res.success !== false;
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  // Laid out (so it can be captured) but never visible.
  offscreen: { position: 'absolute', left: -CARD_WIDTH * 3, top: 0 },
  card: {
    width: CARD_WIDTH,
    padding: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: 1,
    backgroundColor: colors.background,
    gap: spacing.xs,
  },
  hero: { height: 320, alignItems: 'center', justifyContent: 'center' },
  image: { height: 300, aspectRatio: 1019 / 1544 },
  value: { marginTop: spacing.xs },
  footer: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
