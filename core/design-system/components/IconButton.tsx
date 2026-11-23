import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme';
import { ScalePressable } from './Pressable';
import { Icon, type IconName } from './Icon';

export function IconButton({
  name,
  onPress,
  disabled,
  accessibilityLabel,
  style,
  testID,
}: {
  name: IconName;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <ScalePressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={[styles.base, disabled && styles.disabled, style]}
    >
      <Icon name={name} size={18} color={colors.text} />
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  disabled: { opacity: 0.3 },
});
