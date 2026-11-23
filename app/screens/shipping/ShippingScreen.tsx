import React, { useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMoney, isApiError, uuid } from '@core/common';
import { Button, colors, EmptyView, radii, rarityColors, spacing, Text, typography, withAlpha } from '@core/design-system';
import { useWatchesById, watchThumb } from '@core/modules/catalog';
import { isInVault, useOwnedWatch, useShipMutation, type ShippingAddress } from '@core/modules/collection';
import { toast } from '@core/overlays';
import { haptics } from '@core/shared/haptics';
import { useSettingsStore } from '@stores/settingsStore';
import type { CollectionScreenProps } from '@app/navigation/types';

const EMPTY: ShippingAddress = { fullName: '', line1: '', city: '', postalCode: '', country: '' };

type Field = { key: keyof ShippingAddress; label: string; props?: TextInputProps };
const FIELDS: Field[] = [
  { key: 'fullName', label: 'Full name', props: { autoComplete: 'name', textContentType: 'name', autoCapitalize: 'words' } },
  { key: 'line1', label: 'Street and number', props: { autoComplete: 'street-address', textContentType: 'fullStreetAddress' } },
  { key: 'city', label: 'City', props: { textContentType: 'addressCity', autoCapitalize: 'words' } },
  { key: 'postalCode', label: 'Postal code', props: { autoComplete: 'postal-code', textContentType: 'postalCode', autoCapitalize: 'characters' } },
  { key: 'country', label: 'Country', props: { autoComplete: 'country', textContentType: 'countryName', autoCapitalize: 'words' } },
];

function validate(a: ShippingAddress): Partial<Record<keyof ShippingAddress, string>> {
  const errors: Partial<Record<keyof ShippingAddress, string>> = {};
  for (const f of FIELDS) {
    if (!a[f.key].trim()) {
      errors[f.key] = 'Required';
    }
  }
  if (a.postalCode.trim() && a.postalCode.trim().length < 3) {
    errors.postalCode = 'Looks too short';
  }
  return errors;
}

export function ShippingScreen({ route, navigation }: CollectionScreenProps<'Shipping'>) {
  const { instanceId } = route.params;
  const insets = useSafeAreaInsets();
  const owned = useOwnedWatch(instanceId);
  const watchesById = useWatchesById();
  const ship = useShipMutation();
  const lastAddress = useSettingsStore(s => s.lastAddress);
  const setLastAddress = useSettingsStore(s => s.setLastAddress);

  const [address, setAddress] = useState<ShippingAddress>(lastAddress ?? EMPTY);
  const [touched, setTouched] = useState(false);
  // One key per distinct submission: retries of the same form are deduped by the server.
  const attempt = useRef<{ key: string; snapshot: string } | null>(null);
  const refs = useRef<(TextInput | null)[]>([]);

  const watch = owned && watchesById ? watchesById[owned.watchId] : undefined;
  if (!owned || !watch || !isInVault(owned)) {
    return <EmptyView title="Not available" message="Only watches in your vault can be shipped." />;
  }

  const errors = validate(address);
  const valid = Object.keys(errors).length === 0;

  const submit = () => {
    setTouched(true);
    if (!valid) {
      haptics.warning();
      return;
    }
    const snapshot = JSON.stringify(address);
    if (!attempt.current || attempt.current.snapshot !== snapshot) {
      attempt.current = { key: uuid(), snapshot };
    }
    ship.mutate(
      { instanceId, address, idempotencyKey: attempt.current.key },
      {
        onSuccess: () => {
          haptics.success();
          setLastAddress(address);
          toast.success('Delivery requested — track it on the watch page');
          navigation.goBack();
        },
        onError: e => {
          haptics.error();
          toast.error(isApiError(e, 'network') ? 'Network hiccup, try again' : 'Could not request delivery');
        },
      },
    );
  };

  const color = rarityColors[watch.rarity];

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.item, { borderColor: withAlpha(color, 0.3) }]}>
          <View style={[styles.thumb, { backgroundColor: withAlpha(color, 0.1) }]}>
            <Image source={watchThumb(watch)} style={styles.thumbImage} resizeMode="contain" />
          </View>
          <View style={styles.flex}>
            <Text variant="bodyStrong">
              {watch.brand} {watch.name}
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              Insured for {formatMoney(watch.valueCents)} · free delivery
            </Text>
          </View>
        </View>

        <Text variant="caption" color={colors.textMuted}>
          Once it leaves the vault the watch can no longer be sold back or traded up.
        </Text>

        {FIELDS.map((f, i) => {
          const error = touched ? errors[f.key] : undefined;
          return (
            <View key={f.key} style={styles.field}>
              <Text variant="overline" color={error ? colors.danger : colors.textMuted}>
                {f.label}
                {error ? ` · ${error}` : ''}
              </Text>
              <TextInput
                ref={r => {
                  refs.current[i] = r;
                }}
                testID={`address-${f.key}`}
                value={address[f.key]}
                onChangeText={text => setAddress(a => ({ ...a, [f.key]: text }))}
                placeholderTextColor={colors.textFaint}
                placeholder={f.label}
                returnKeyType={i === FIELDS.length - 1 ? 'done' : 'next'}
                onSubmitEditing={() => (i === FIELDS.length - 1 ? submit() : refs.current[i + 1]?.focus())}
                submitBehavior={i === FIELDS.length - 1 ? 'blurAndSubmit' : 'submit'}
                style={[styles.input, error && { borderColor: colors.danger }]}
                {...f.props}
              />
            </View>
          );
        })}

        <Button
          testID="ship-submit"
          title="Request delivery"
          loading={ship.isPending}
          onPress={submit}
          style={styles.submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
  },
  thumb: { width: 56, height: 64, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  thumbImage: { height: 58, aspectRatio: 1019 / 1544 },
  flex: { flex: 1, gap: 2 },
  field: { gap: spacing.xs },
  input: {
    ...typography.body,
    color: colors.text,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  submit: { marginTop: spacing.md },
});
