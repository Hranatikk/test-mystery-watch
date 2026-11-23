import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing, Text } from '@core/design-system';

export function SheetTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      <Text variant="title">{title}</Text>
      {subtitle ? (
        <Text variant="body" color={colors.textMuted} style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function SheetRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={styles.row}>
      <Text variant="body" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant={emphasis ? 'heading' : 'mono'} color={emphasis ? colors.text : colors.text}>
        {value}
      </Text>
    </View>
  );
}

export function SheetActions({ children }: { children: React.ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.lg },
  subtitle: { marginTop: spacing.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  actions: { marginTop: spacing.xl, gap: spacing.sm },
});
