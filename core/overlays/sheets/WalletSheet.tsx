import React from 'react';
import { StyleSheet, View } from 'react-native';
import { formatMoney, isApiError } from '@core/common';
import { Button, colors, spacing, Text } from '@core/design-system';
import { useBalanceQuery, useTopUpMutation } from '@core/modules/wallet';
import { haptics } from '@core/shared/haptics';
import { toast } from '../overlayStore';
import { SheetActions, SheetTitle } from './SheetLayout';

export type WalletSheetProps = {
  topUpAmountCents: number;
  /** When set, the sheet explains how much is missing for a purchase. */
  requiredCents?: number;
  onFunded?: () => void;
  onClose: () => void;
  footer?: React.ReactNode;
};

export function WalletSheet({ topUpAmountCents, requiredCents, onFunded, onClose, footer }: WalletSheetProps) {
  const { data: balance } = useBalanceQuery();
  const topUp = useTopUpMutation();
  const missing = requiredCents != null && balance != null ? requiredCents - balance : 0;
  const insufficient = missing > 0;

  const onTopUp = () => {
    topUp.mutate(undefined, {
      onSuccess: next => {
        haptics.success();
        toast.success(`+${formatMoney(topUpAmountCents)} added`);
        if (requiredCents != null && next >= requiredCents) {
          onFunded?.();
        }
      },
      onError: e => {
        haptics.error();
        toast.error(isApiError(e, 'network') ? 'Network hiccup, try again' : 'Top up failed');
      },
    });
  };

  return (
    <>
      <SheetTitle
        title={requiredCents != null && insufficient ? 'Not enough balance' : 'Wallet'}
        subtitle={
          requiredCents != null && insufficient
            ? `You need ${formatMoney(missing)} more to open this box.`
            : 'Demo money. Top up as much as you like.'
        }
      />
      <View style={styles.balance}>
        <Text variant="overline" color={colors.textMuted}>
          Balance
        </Text>
        <Text variant="display" testID="wallet-balance">
          {balance != null ? formatMoney(balance) : '—'}
        </Text>
      </View>
      <SheetActions>
        <Button
          testID="top-up"
          title={`Top up ${formatMoney(topUpAmountCents)}`}
          loading={topUp.isPending}
          onPress={onTopUp}
        />
        {requiredCents != null && !insufficient && onFunded ? (
          <Button title="Continue" variant="secondary" onPress={onFunded} />
        ) : (
          <Button title="Close" variant="ghost" onPress={onClose} />
        )}
      </SheetActions>
      {footer}
    </>
  );
}

const styles = StyleSheet.create({
  balance: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.xs },
});
