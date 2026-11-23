import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMoney } from '@core/common';
import {
  Button,
  colors,
  EmptyView,
  ErrorView,
  LoadingView,
  radii,
  ScalePressable,
  spacing,
  Text,
} from '@core/design-system';
import { profitAndLoss, useActivityQuery } from '@core/modules/activity';
import { useBoxesQuery, useWatchesById } from '@core/modules/catalog';
import { isInVault, useCollectionQuery, type OwnedWatch } from '@core/modules/collection';
import { SegmentedControl } from '@app/components/SegmentedControl';
import { UnrevealedTile, WatchTile } from '@app/components/WatchTile';
import { useRootNavigation } from '@app/navigation/hooks';
import type { CollectionScreenProps } from '@app/navigation/types';
import { WishlistView } from './WishlistView';

type Tab = 'owned' | 'wishlist';

const SHIPMENT_BADGE = { processing: 'Preparing', shipped: 'In transit', delivered: 'Delivered' } as const;

export function CollectionScreen({ navigation }: CollectionScreenProps<'Collection'>) {
  const [tab, setTab] = useState<Tab>('owned');
  return (
    <View style={styles.screen}>
      <View style={styles.segments}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'owned', label: 'My watches' },
            { value: 'wishlist', label: 'Wishlist' },
          ]}
        />
      </View>
      {tab === 'owned' ? <OwnedList navigation={navigation} /> : <WishlistView />}
    </View>
  );
}

function OwnedList({ navigation }: Pick<CollectionScreenProps<'Collection'>, 'navigation'>) {
  const rootNavigation = useRootNavigation();
  const insets = useSafeAreaInsets();
  const { data: items, isLoading, error, refetch, isRefetching } = useCollectionQuery();
  const { data: activity } = useActivityQuery();
  const watchesById = useWatchesById();
  const { data: boxes } = useBoxesQuery();
  const boxesById = useMemo(() => Object.fromEntries((boxes ?? []).map(b => [b.id, b])), [boxes]);

  // Unopened boxes first: they are the user's most pressing action.
  const sorted = useMemo(
    () => [...(items ?? [])].sort((a, b) => Number(a.revealed) - Number(b.revealed)),
    [items],
  );
  const pnl = useMemo(
    () => (items && watchesById ? profitAndLoss(activity ?? [], items, watchesById) : undefined),
    [activity, items, watchesById],
  );
  const vaultCount = items?.filter(isInVault).length ?? 0;

  if (isLoading || !watchesById) {
    return <LoadingView label="Loading collection" />;
  }
  if (error) {
    return <ErrorView message="Couldn't load your collection." onRetry={refetch} />;
  }
  if (!sorted.length) {
    return (
      <EmptyView
        title="No watches yet"
        message="Open a box and your wins will land here."
        action={
          <View style={styles.emptyActions}>
            <Button
              title="Browse boxes"
              onPress={() => rootNavigation.navigate('Main', { screen: 'CatalogueTab', params: { screen: 'Catalogue' } })}
            />
            {activity?.length ? (
              <Button title="View history" variant="ghost" onPress={() => navigation.navigate('History')} />
            ) : null}
          </View>
        }
      />
    );
  }

  const renderItem = ({ item }: { item: OwnedWatch }) => {
    const watch = watchesById[item.watchId];
    if (!item.revealed && item.boxId) {
      const box = boxesById[item.boxId];
      const boxId = item.boxId;
      return (
        <View style={styles.cell}>
          <UnrevealedTile
            accent={box?.theme.accent ?? colors.gold}
            boxName={box?.name ?? 'Mystery box'}
            onPress={() => rootNavigation.navigate('Opening', { boxId, instanceId: item.instanceId })}
          />
        </View>
      );
    }
    if (!watch) {
      return <View style={styles.cell} />;
    }
    return (
      <View style={styles.cell}>
        <WatchTile
          testID={`owned-${item.instanceId}`}
          watch={watch}
          badge={item.shipment ? SHIPMENT_BADGE[item.shipment.status] : undefined}
          onPress={() => navigation.navigate('WatchDetails', { instanceId: item.instanceId })}
        />
      </View>
    );
  };

  return (
    <FlatList
      style={styles.list}
      data={sorted}
      keyExtractor={i => i.instanceId}
      numColumns={2}
      renderItem={renderItem}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      columnWrapperStyle={styles.row}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />}
      ListHeaderComponent={
        pnl ? (
          <View style={styles.header}>
            <ScalePressable
              testID="pnl-card"
              accessibilityRole="button"
              accessibilityLabel={`Collection value ${formatMoney(pnl.heldCents)}. Net ${formatMoney(pnl.netCents)}. Open history`}
              onPress={() => navigation.navigate('History')}
              style={styles.summary}
            >
              <View style={styles.summaryRow}>
                <View style={styles.summaryCol}>
                  <Text variant="overline" color={colors.textMuted}>
                    Collection value
                  </Text>
                  <Text variant="title" color={colors.gold}>
                    {formatMoney(pnl.heldCents)}
                  </Text>
                </View>
                <View style={[styles.summaryCol, styles.alignEnd]}>
                  <Text variant="overline" color={colors.textMuted}>
                    Net result
                  </Text>
                  <Text variant="title" color={pnl.netCents >= 0 ? colors.success : colors.danger}>
                    {pnl.netCents >= 0 ? '+' : '−'}
                    {formatMoney(Math.abs(pnl.netCents))}
                  </Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <Stat label="Spent" value={formatMoney(pnl.spentCents)} />
                <Stat label="Sold" value={formatMoney(pnl.soldCents)} />
                <Stat label="Boxes" value={String(pnl.boxesOpened)} />
                <Text variant="caption" color={colors.textMuted} style={styles.historyLink}>
                  History ›
                </Text>
              </View>
            </ScalePressable>
            <Button
              testID="open-trade-up"
              title="Trade up"
              subtitle="Stake watches for a pricier one"
              variant="secondary"
              disabled={vaultCount === 0}
              onPress={() => navigation.navigate('TradeUp')}
            />
          </View>
        ) : null
      }
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="caption" color={colors.textFaint}>
        {label}
      </Text>
      <Text variant="caption" color={colors.text}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  segments: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  list: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  row: { gap: spacing.md },
  cell: { flex: 1 },
  header: { gap: spacing.md, marginBottom: spacing.xs },
  summary: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.md,
  },
  summaryRow: { flexDirection: 'row' },
  summaryCol: { flex: 1, gap: spacing.xs },
  alignEnd: { alignItems: 'flex-end' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  stat: { gap: 2 },
  historyLink: { marginLeft: 'auto' },
  emptyActions: { gap: spacing.sm, alignSelf: 'stretch' },
});
