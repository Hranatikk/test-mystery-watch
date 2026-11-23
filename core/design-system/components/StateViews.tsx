import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.gold} />
      {label ? (
        <Text variant="caption" color={colors.textMuted} style={styles.gap}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text variant="heading" align="center">
        Something went wrong
      </Text>
      <Text variant="body" color={colors.textMuted} align="center" style={styles.gap}>
        {message}
      </Text>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} style={styles.button} /> : null}
    </View>
  );
}

export function EmptyView({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return (
    <View style={styles.center}>
      <Text variant="title" align="center">
        {title}
      </Text>
      <Text variant="body" color={colors.textMuted} align="center" style={styles.gap}>
        {message}
      </Text>
      {action ? <View style={styles.button}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  gap: { marginTop: spacing.sm },
  button: { marginTop: spacing.xl, alignSelf: 'stretch' },
});
