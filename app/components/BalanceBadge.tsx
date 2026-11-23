import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { formatMoney } from '@core/common';
import { colors, Icon, radii, ScalePressable, spacing, Text } from '@core/design-system';
import { useBalanceQuery } from '@core/modules/wallet';
import { openWalletSheet } from './sheets';

/** Header balance. Tapping opens the (mock) top up sheet. Pulses on change. */
export function BalanceBadge() {
  const { data: balance, isLoading } = useBalanceQuery();
  const pulse = useSharedValue(1);
  const prev = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (balance != null && prev.current != null && balance !== prev.current) {
      pulse.value = withSequence(withTiming(1.12, { duration: 140 }), withTiming(1, { duration: 220 }));
    }
    prev.current = balance;
  }, [balance, pulse]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <ScalePressable
      testID="balance-badge"
      accessibilityRole="button"
      accessibilityLabel={`Balance ${balance != null ? formatMoney(balance) : 'loading'}. Tap to top up`}
      onPress={openWalletSheet}
      hitSlop={8}
    >
      <Animated.View style={[styles.badge, style]}>
        <Text variant="mono" color={colors.gold}>
          {isLoading || balance == null ? '···' : formatMoney(balance)}
        </Text>
        <View style={styles.plus}>
          <Icon name="plus" size={9} color={colors.onGold} />
        </View>
      </Animated.View>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: 6,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(232,194,122,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232,194,122,0.35)',
  },
  plus: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
