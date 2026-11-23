import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radii, ScalePressable, spacing, Text } from '@core/design-system';
import { haptics } from '@core/shared/haptics';

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map(o => {
        const selected = o.value === value;
        return (
          <ScalePressable
            key={o.value}
            testID={`segment-${o.value}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) {
                haptics.selection();
                onChange(o.value);
              }
            }}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text variant="bodyStrong" color={selected ? colors.text : colors.textMuted}>
              {o.label}
            </Text>
          </ScalePressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 3,
  },
  segment: { flex: 1, height: 36, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: colors.surfaceRaised, paddingHorizontal: spacing.sm },
});
