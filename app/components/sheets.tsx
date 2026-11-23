import React from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { mockApiConfig } from '@app/config/api';
import { colors, spacing, Text } from '@core/design-system';
import { Button } from '@core/design-system';
import { ConfirmPurchaseSheet, SheetActions, SheetTitle, useOverlayStore, WalletSheet } from '@core/overlays';
import { useSettingsStore } from '@stores/settingsStore';

function SettingRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.settingRow}>
      <Text variant="body" color={colors.textMuted}>
        {label}
      </Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.goldDeep, false: colors.surfaceRaised }}
        thumbColor={colors.text}
      />
    </View>
  );
}

function SettingsFooter() {
  const hapticsEnabled = useSettingsStore(s => s.hapticsEnabled);
  const setHapticsEnabled = useSettingsStore(s => s.setHapticsEnabled);
  const soundEnabled = useSettingsStore(s => s.soundEnabled);
  const setSoundEnabled = useSettingsStore(s => s.setSoundEnabled);
  return (
    <View style={styles.settings}>
      <SettingRow label="Sound" value={soundEnabled} onChange={setSoundEnabled} />
      <SettingRow label="Haptics" value={hapticsEnabled} onChange={setHapticsEnabled} />
    </View>
  );
}

const WELCOME_POINTS = [
  ['Real odds', 'Every box lists what is inside and how likely each watch is.'],
  ['Decided on payment', 'The server rolls the moment you pay; the opening just shows it.'],
  ['Bad-luck protection', 'Each box guarantees a rarer pull within a set number of opens.'],
  ['Your call', 'Keep a watch, sell it back for 80%, ship it home or trade it up.'],
] as const;

export function openWelcomeSheet(onDone: () => void) {
  useOverlayStore.getState().showSheet({
    key: 'welcome',
    onDismiss: onDone,
    render: close => (
      <>
        <SheetTitle title="Welcome to Mystery Watch" subtitle="You start with $5,000 of demo balance." />
        <View style={styles.points}>
          {WELCOME_POINTS.map(([title, body]) => (
            <View key={title} style={styles.point}>
              <View style={styles.bullet} />
              <View style={styles.pointText}>
                <Text variant="bodyStrong">{title}</Text>
                <Text variant="caption" color={colors.textMuted}>
                  {body}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <SheetActions>
          <Button
            testID="welcome-start"
            title="Start browsing"
            onPress={() => {
              close();
              onDone();
            }}
          />
        </SheetActions>
      </>
    ),
  });
}

export function openWalletSheet() {
  useOverlayStore.getState().showSheet({
    key: 'wallet',
    render: close => (
      <WalletSheet topUpAmountCents={mockApiConfig.topUpAmountCents} onClose={close} footer={<SettingsFooter />} />
    ),
  });
}

export function openInsufficientFundsSheet(requiredCents: number, onFunded?: () => void) {
  useOverlayStore.getState().showSheet({
    key: `funds-${requiredCents}`,
    render: close => (
      <WalletSheet
        topUpAmountCents={mockApiConfig.topUpAmountCents}
        requiredCents={requiredCents}
        onClose={close}
        onFunded={
          onFunded
            ? () => {
                close();
                onFunded();
              }
            : undefined
        }
      />
    ),
  });
}

export function openConfirmPurchaseSheet(params: {
  boxName: string;
  priceCents: number;
  balanceCents: number;
  tint?: string;
  onConfirm: () => void;
}) {
  useOverlayStore.getState().showSheet({
    key: 'confirm-purchase',
    render: close => (
      <ConfirmPurchaseSheet
        {...params}
        onCancel={close}
        onConfirm={() => {
          close();
          params.onConfirm();
        }}
      />
    ),
  });
}

const styles = StyleSheet.create({
  settings: {
    marginTop: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  points: { gap: spacing.md },
  point: { flexDirection: 'row', gap: spacing.md },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold, marginTop: 7 },
  pointText: { flex: 1, gap: 2 },
  settingRow: {
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
