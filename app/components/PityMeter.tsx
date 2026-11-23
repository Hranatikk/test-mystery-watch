import React from 'react';
import { StyleSheet, View } from 'react-native';
import { RARITY_LABEL } from '@core/common';
import { colors, rarityColors, spacing, Text } from '@core/design-system';
import { opensUntilPity, type Box } from '@core/modules/catalog';

/** "Epic+ guaranteed within 7 opens" with progress towards the guarantee. */
export function PityMeter({ box, pityCount }: { box: Box; pityCount: number }) {
  const left = opensUntilPity(box, pityCount);
  const color = rarityColors[box.pity.minRarity];
  const progress = Math.min(1, pityCount / Math.max(1, box.pity.within - 1));
  const label =
    left === 1
      ? `Next open is a guaranteed ${RARITY_LABEL[box.pity.minRarity]}+`
      : `${RARITY_LABEL[box.pity.minRarity]}+ guaranteed within ${left} opens`;
  return (
    <View
      style={styles.wrap}
      testID="pity-meter"
      accessible
      accessibilityLabel={`${label}. ${pityCount} opens without one so far.`}
    >
      <View style={styles.row}>
        <Text variant="caption" color={left === 1 ? color : colors.textMuted}>
          {label}
        </Text>
        <Text variant="caption" color={colors.textFaint}>
          {pityCount}/{box.pity.within}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(2, progress * 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});
