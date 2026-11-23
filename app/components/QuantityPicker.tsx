import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radii, ScalePressable, spacing, Text, withAlpha } from '@core/design-system';
import { haptics } from '@core/shared/haptics';

export const OPEN_COUNTS = [1, 3, 5] as const;
export type OpenCount = (typeof OPEN_COUNTS)[number];

export function QuantityPicker({
  value,
  onChange,
  accent,
}: {
  value: number;
  onChange: (count: OpenCount) => void;
  accent: string;
}) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="How many boxes to open">
      {OPEN_COUNTS.map(count => {
        const selected = value === count;
        return (
          <ScalePressable
            key={count}
            testID={`quantity-${count}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`Open ${count}`}
            onPress={() => {
              if (!selected) {
                haptics.selection();
                onChange(count);
              }
            }}
            style={[
              styles.chip,
              selected && { backgroundColor: withAlpha(accent, 0.18), borderColor: withAlpha(accent, 0.7) },
            ]}
          >
            <Text variant="bodyStrong" color={selected ? accent : colors.textMuted}>
              ×{count}
            </Text>
          </ScalePressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
});
