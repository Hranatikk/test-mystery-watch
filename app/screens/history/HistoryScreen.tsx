import React, { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMoney } from '@core/common';
import { colors, EmptyView, ErrorView, LoadingView, radii, rarityColors, spacing, Text } from '@core/design-system';
import { profitAndLoss, useActivityQuery, type ActivityEntry } from '@core/modules/activity';
import { useBoxesQuery, useWatchesById, type Box, type Watch } from '@core/modules/catalog';
import { useCollectionQuery } from '@core/modules/collection';

type Row = { title: string; subtitle: string; amountCents: number; dot: string };

function describe(e: ActivityEntry, boxes: Record<string, Box>, watches: Record<string, Watch>): Row {
  const name = (id: string) => watches[id]?.name ?? 'Watch';
  switch (e.kind) {
    case 'open': {
      const best = watches[e.watchIds[e.watchIds.length - 1]];
      return {
        title: `Opened ${e.count > 1 ? `${e.count} × ` : ''}${boxes[e.boxId]?.name ?? 'box'}`,
        subtitle: [...e.watchIds].reverse().map(name).join(', '),
        amountCents: e.amountCents,
        dot: best ? rarityColors[best.rarity] : colors.textFaint,
      };
    }
    case 'sell':
      return { title: `Sold ${name(e.watchId)}`, subtitle: 'Sell-back', amountCents: e.amountCents, dot: colors.success };
    case 'topup':
      return { title: 'Balance top-up', subtitle: 'Demo funds', amountCents: e.amountCents, dot: colors.gold };
    case 'tradeup':
      return {
        title: `Trade-up ${e.won ? 'won' : 'missed'}: ${name(e.targetWatchId)}`,
        subtitle: `${e.stakeWatchIds.length} staked · ${(e.chance * 100).toFixed(1)}% chance`,
        amountCents: 0,
        dot: e.won ? colors.success : colors.danger,
      };
    case 'ship':
      return { title: 'Delivery requested', subtitle: name(e.watchId), amountCents: 0, dot: colors.textMuted };
  }
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { data: activity, isLoading, error, refetch, isRefetching } = useActivityQuery();
  const { data: collection } = useCollectionQuery();
  const { data: boxes } = useBoxesQuery();
  const watchesById = useWatchesById();
  const boxesById = useMemo(() => Object.fromEntries((boxes ?? []).map(b => [b.id, b])), [boxes]);
  const pnl = useMemo(
    () => (activity && collection && watchesById ? profitAndLoss(activity, collection, watchesById) : undefined),
    [activity, collection, watchesById],
  );

  if (isLoading || !watchesById) {
    return <LoadingView label="Loading history" />;
  }
  if (error || !activity) {
    return <ErrorView message="Couldn't load your history." onRetry={refetch} />;
  }
  if (!activity.length) {
    return <EmptyView title="Nothing here yet" message="Every purchase, sale and trade-up will be listed here." />;
  }

  return (
    <FlatList
      style={styles.screen}
      data={activity}
      keyExtractor={e => e.id}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />}
      ListHeaderComponent={
        pnl ? (
          <View style={styles.summary}>
            <SummaryLine label="Spent on boxes" value={`−${formatMoney(pnl.spentCents)}`} />
            <SummaryLine label="Received from sales" value={`+${formatMoney(pnl.soldCents)}`} />
            <SummaryLine label="Watches you still hold" value={formatMoney(pnl.heldCents)} />
            <View style={styles.divider} />
            <SummaryLine
              label="Net result"
              value={`${pnl.netCents >= 0 ? '+' : '−'}${formatMoney(Math.abs(pnl.netCents))}`}
              color={pnl.netCents >= 0 ? colors.success : colors.danger}
              strong
            />
            {pnl.unopened ? (
              <Text variant="caption" color={colors.textFaint}>
                {pnl.unopened} unopened {pnl.unopened > 1 ? 'pulls are' : 'pull is'} not counted until revealed.
              </Text>
            ) : null}
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const row = describe(item, boxesById, watchesById);
        return (
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: row.dot }]} />
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {row.title}
              </Text>
              <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                {row.subtitle}
              </Text>
              <Text variant="caption" color={colors.textFaint}>
                {formatWhen(item.at)}
              </Text>
            </View>
            {row.amountCents !== 0 ? (
              <Text variant="mono" color={row.amountCents > 0 ? colors.success : colors.text}>
                {row.amountCents > 0 ? '+' : '−'}
                {formatMoney(Math.abs(row.amountCents))}
              </Text>
            ) : null}
          </View>
        );
      }}
    />
  );
}

function SummaryLine({ label, value, color = colors.text, strong }: { label: string; value: string; color?: string; strong?: boolean }) {
  return (
    <View style={styles.summaryLine}>
      <Text variant={strong ? 'bodyStrong' : 'body'} color={strong ? colors.text : colors.textMuted}>
        {label}
      </Text>
      <Text variant={strong ? 'heading' : 'mono'} color={color}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm },
  summary: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  flex: { flex: 1, gap: 2 },
});
