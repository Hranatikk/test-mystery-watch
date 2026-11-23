import React from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../theme';
import { ScalePressable } from './Pressable';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  /** Overrides the primary fill (e.g. box accent). */
  tint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({
  title,
  subtitle,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  tint,
  style,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const fill =
    variant === 'primary' ? tint ?? colors.gold : variant === 'secondary' ? colors.surfaceRaised : 'transparent';
  const textColor = variant === 'primary' ? colors.onGold : colors.text;

  return (
    <ScalePressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        { backgroundColor: fill, opacity: isDisabled && !loading ? 0.45 : 1 },
        variant === 'secondary' && styles.secondary,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          <Text variant="bodyStrong" color={textColor}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" color={textColor} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  content: { alignItems: 'center' },
  subtitle: { opacity: 0.75 },
});
