import React, { useRef } from 'react';
import { Image, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mockApiConfig } from '@app/config/api';
import { formatMoney, isApiError } from '@core/common';
import { Button, colors, EmptyView, IconButton, radii, RarityBadge, rarityColors, spacing, Text } from '@core/design-system';
import { useBoxesQuery, useWatchesById, useWatchesQuery, watchImage } from '@core/modules/catalog';
import {
  isInVault,
  useOwnedWatch,
  useSellBackMutation,
  useShipmentPolling,
  type Shipment,
  type ShipmentStatus,
} from '@core/modules/collection';
import { SheetActions, SheetRow, SheetTitle, toast, useOverlayStore } from '@core/overlays';
import { haptics } from '@core/shared/haptics';
import { playSound } from '@core/shared/sound';
import { Glow } from '@app/components/Glow';
import { ShareCard, shareCard } from '@app/components/ShareCard';
import { WishlistButton } from '@app/components/WishlistButton';
import type { CollectionScreenProps } from '@app/navigation/types';

export function WatchDetailsScreen({ route, navigation }: CollectionScreenProps<'WatchDetails'>) {
  const { instanceId } = route.params;
  const owned = useOwnedWatch(instanceId);
  useShipmentPolling(owned);
  const watchesById = useWatchesById();
  const { data: allWatches } = useWatchesQuery();
  const { data: boxes } = useBoxesQuery();
  const sellBack = useSellBackMutation();
  const insets = useSafeAreaInsets();
  // Transparent header: start the hero below the status bar and nav bar.
  const headerHeight = useHeaderHeight();
  const { width } = useWindowDimensions();
  const shareRef = useRef<View>(null);

  const watch = owned && watchesById ? watchesById[owned.watchId] : undefined;
  const box = boxes?.find(b => b.id === owned?.boxId);

  if (!owned || !watch) {
    return <EmptyView title="Not in your collection" message="This watch may have been sold." />;
  }

  const color = rarityColors[watch.rarity];
  const offer = Math.round(watch.valueCents * mockApiConfig.sellBackRatio);
  const inVault = isInVault(owned);
  // The priciest watch has nothing to trade up to.
  const canTradeUp = allWatches?.some(w => w.valueCents > watch.valueCents) ?? false;

  const confirmSell = () => {
    useOverlayStore.getState().showSheet({
      key: `sell-${instanceId}`,
      render: close => (
        <>
          <SheetTitle title="Sell back?" subtitle={`${watch.brand} ${watch.name} goes back to the vault.`} />
          <SheetRow label="Market value" value={formatMoney(watch.valueCents)} />
          <SheetRow label="You receive" value={formatMoney(offer)} emphasis />
          <SheetActions>
            <Button
              title={`Sell for ${formatMoney(offer)}`}
              onPress={() => {
                close();
                sellBack.mutate(instanceId, {
                  onSuccess: ({ creditedCents }) => {
                    haptics.success();
                    playSound('sell');
                    toast.success(`+${formatMoney(creditedCents)} added to balance`);
                    navigation.goBack();
                  },
                  onError: e => {
                    haptics.error();
                    toast.error(isApiError(e, 'network') ? 'Network hiccup, try again' : 'Could not sell this watch');
                  },
                });
              }}
            />
            <Button title="Keep it" variant="ghost" onPress={close} />
          </SheetActions>
        </>
      ),
    });
  };

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + spacing.xxl }}
      >
        <View style={styles.hero}>
          <Glow color={color} size={width} intensity={0.5} />
          <Image source={watchImage(watch)} style={styles.image} resizeMode="contain" />
          <View style={styles.heroActions}>
            <IconButton
              name="share"
              accessibilityLabel="Share this watch"
              onPress={() => {
                haptics.selection();
                shareCard(shareRef, watch);
              }}
            />
            <WishlistButton watchId={watch.id} label={watch.name} />
          </View>
        </View>
        <View style={styles.body}>
          <RarityBadge rarity={watch.rarity} />
          <Text variant="caption" color={colors.textMuted} style={styles.brand}>
            {watch.brand} · Ref. {watch.reference}
          </Text>
          <Text variant="display">{watch.name}</Text>
          <View style={styles.card}>
            <SheetRow label="Market value" value={formatMoney(watch.valueCents)} emphasis />
            <SheetRow label="From" value={owned.origin === 'tradeup' ? 'Trade-up' : box?.name ?? '—'} />
            <SheetRow label="Won" value={new Date(owned.acquiredAt).toLocaleDateString()} />
          </View>

          {owned.shipment ? <ShipmentCard shipment={owned.shipment} /> : null}

          {inVault ? (
            <View style={styles.actions}>
              <Button
                testID="ship-watch"
                title="Ship to me"
                subtitle="Free insured delivery"
                onPress={() => navigation.navigate('Shipping', { instanceId })}
              />
              <View style={styles.row}>
                {canTradeUp ? (
                  <Button
                    title="Trade up"
                    variant="secondary"
                    onPress={() => navigation.navigate('TradeUp', { preselect: instanceId })}
                    style={styles.flex}
                  />
                ) : null}
                <Button
                  title="Sell back"
                  subtitle={formatMoney(offer)}
                  variant="secondary"
                  loading={sellBack.isPending}
                  onPress={confirmSell}
                  style={styles.flex}
                />
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
      <ShareCard ref={shareRef} watch={watch} boxName={box?.name ?? null} />
    </>
  );
}

const STEPS: { status: ShipmentStatus; label: string; hint: string }[] = [
  { status: 'processing', label: 'Preparing', hint: 'Authenticated and packed in the vault' },
  { status: 'shipped', label: 'Shipped', hint: 'Insured courier, signature on delivery' },
  { status: 'delivered', label: 'Delivered', hint: 'Enjoy it' },
];

function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const reached = new Map(shipment.timeline.map(t => [t.status, t.at]));
  const { address } = shipment;
  return (
    <View style={[styles.card, styles.shipment]} testID="shipment-card">
      <View style={styles.shipmentHeader}>
        <Text variant="heading">Delivery</Text>
        <Text variant="caption" color={colors.textMuted}>
          {shipment.trackingCode}
        </Text>
      </View>
      {STEPS.map((step, i) => {
        const at = reached.get(step.status);
        const isCurrent = shipment.status === step.status;
        const nextReached = i < STEPS.length - 1 && reached.has(STEPS[i + 1].status);
        return (
          <View key={step.status} style={styles.step}>
            <View style={styles.rail}>
              <View style={[styles.node, at != null && styles.nodeDone, isCurrent && styles.nodeCurrent]} />
              {i < STEPS.length - 1 ? <View style={[styles.line, nextReached && styles.lineDone]} /> : null}
            </View>
            <View style={styles.stepBody}>
              <Text variant="bodyStrong" color={at != null ? colors.text : colors.textFaint}>
                {step.label}
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                {at != null ? new Date(at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : step.hint}
              </Text>
            </View>
          </View>
        );
      })}
      <Text variant="caption" color={colors.textFaint}>
        To {address.fullName}, {address.line1}, {address.postalCode} {address.city}, {address.country}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  hero: { height: 380, alignItems: 'center', justifyContent: 'center' },
  image: { height: 340, aspectRatio: 1019 / 1544 },
  heroActions: { position: 'absolute', right: spacing.lg, top: spacing.sm, gap: spacing.sm },
  body: { paddingHorizontal: spacing.xl, gap: spacing.xs },
  brand: { marginTop: spacing.sm },
  card: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  actions: { marginTop: spacing.xl, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1, paddingHorizontal: spacing.md },
  shipment: { paddingVertical: spacing.lg, gap: spacing.xs },
  shipmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm },
  step: { flexDirection: 'row', gap: spacing.md, minHeight: 52 },
  rail: { width: 14, alignItems: 'center' },
  node: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.borderStrong, marginTop: 4 },
  nodeDone: { backgroundColor: colors.gold, borderColor: colors.gold },
  nodeCurrent: { shadowColor: colors.gold, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  lineDone: { backgroundColor: colors.goldDeep },
  stepBody: { flex: 1, gap: 2, paddingBottom: spacing.md },
});
