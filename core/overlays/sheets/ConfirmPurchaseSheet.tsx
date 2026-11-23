import React from 'react';
import { formatMoney } from '@core/common';
import { Button } from '@core/design-system';
import { SheetActions, SheetRow, SheetTitle } from './SheetLayout';

export type ConfirmPurchaseProps = {
  boxName: string;
  priceCents: number;
  balanceCents: number;
  tint?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmPurchaseSheet({
  boxName,
  priceCents,
  balanceCents,
  tint,
  onConfirm,
  onCancel,
}: ConfirmPurchaseProps) {
  return (
    <>
      <SheetTitle title={`Open ${boxName}?`} subtitle="The result is decided the moment you pay." />
      <SheetRow label="Price" value={formatMoney(priceCents)} />
      <SheetRow label="Balance after" value={formatMoney(balanceCents - priceCents)} />
      <SheetActions>
        <Button testID="confirm-purchase" title={`Pay ${formatMoney(priceCents)}`} tint={tint} onPress={onConfirm} />
        <Button title="Not now" variant="ghost" onPress={onCancel} />
      </SheetActions>
    </>
  );
}
