import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { colors, typography, type TypographyVariant } from '../theme';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: string;
  align?: TextStyle['textAlign'];
};

export function Text({ variant = 'body', color = colors.text, align, style, ...rest }: TextProps) {
  return (
    <RNText
      {...rest}
      style={[typography[variant] as TextStyle, { color, textAlign: align }, style]}
    />
  );
}
