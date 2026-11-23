import React from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { formatMoney } from '@core/common';
import {
  Button,
  colors,
  IconButton,
  radii,
  RarityBadge,
  rarityColors,
  spacing,
  Text,
  withAlpha,
} from '@core/design-system';
import { watchThumb, type Box, type Watch } from '@core/modules/catalog';
import type { OwnedWatch } from '@core/modules/collection';
import { PityMeter } from '@app/components/PityMeter';
import { QuantityPicker, type OpenCount } from '@app/components/QuantityPicker';
import { SwipeHint } from './SwipeHint';

// ---------------------------------------------------------------- inspecting

export function InspectPanel({
  box,
  count,
  onCountChange,
  pityCount,
  onBuy,
}: {
  box: Box;
  count: OpenCount;
  onCountChange: (count: OpenCount) => void;
  pityCount: number | undefined;
  onBuy: () => void;
}) {
  const accent = box.theme.accent;
  return (
    <Animated.View key="inspect" entering={FadeInDown.duration(250)} exiting={FadeOut.duration(150)} style={styles.panel}>
      <Text variant="caption" color={colors.textMuted} align="center">
        Drag to look around · Double-tap to reset
      </Text>
      <View style={[styles.card, styles.compact]}>
        {pityCount != null ? <PityMeter box={box} pityCount={pityCount} /> : null}
        <QuantityPicker value={count} onChange={onCountChange} accent={accent} />
      </View>
      <Button
        testID="opening-buy"
        title={count > 1 ? `Buy ${count} & open` : 'Buy & open'}
        subtitle={formatMoney(box.priceCents * count)}
        tint={accent}
        onPress={onBuy}
      />
    </Animated.View>
  );
}

export function PurchasingPanel({ accent, count }: { accent: string; count: number }) {
  return (
    <Animated.View key="purchasing" entering={FadeIn.duration(200)} style={styles.panel}>
      <Text variant="caption" color={colors.textMuted} align="center">
        {count > 1 ? `Securing your ${count} boxes…` : 'Securing your box…'}
      </Text>
      <Button testID="opening-purchasing" title="Processing" loading tint={accent} />
    </Animated.View>
  );
}

export function ErrorPanel({ accent, onRetry, onCancel }: { accent: string; onRetry: () => void; onCancel: () => void }) {
  return (
    <Animated.View key="error" entering={FadeInDown.duration(250)} style={[styles.panel, styles.card]}>
      <Text variant="heading">Payment didn't go through</Text>
      <Text variant="body" color={colors.textMuted}>
        The connection dropped. Retrying reuses the same request, so you can never be charged twice.
      </Text>
      <Button testID="opening-retry" title="Retry" tint={accent} onPress={onRetry} />
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </Animated.View>
  );
}

export function ReadyPanel({
  accent,
  count,
  disabled,
  onOpenForMe,
}: {
  accent: string;
  count: number;
  disabled: boolean;
  onOpenForMe: () => void;
}) {
  return (
    <Animated.View key="ready" entering={FadeInDown.duration(300)} exiting={FadeOut.duration(150)} style={styles.panel}>
      {count > 1 ? (
        <Text variant="caption" color={colors.textMuted} align="center">
          {count} watches inside · the best one comes last
        </Text>
      ) : null}
      <SwipeHint color={accent} />
      <Button
        testID="opening-open-for-me"
        title="Open it for me"
        variant="ghost"
        disabled={disabled}
        onPress={onOpenForMe}
      />
    </Animated.View>
  );
}

// ------------------------------------------------------------------ revealed

export type SaleState = { soldCents?: number; selling: boolean };

export function RevealCard({
  box,
  watch,
  index,
  total,
  sale,
  sellOfferCents,
  onNext,
  onSell,
  onKeep,
  onOpenAgain,
  onShare,
}: {
  box: Box;
  watch: Watch;
  index: number;
  total: number;
  sale: SaleState;
  sellOfferCents: number;
  onNext: () => void;
  onSell: () => void;
  onKeep: () => void;
  onOpenAgain: () => void;
  onShare: () => void;
}) {
  const multi = total > 1;
  const multiple = watch.valueCents / box.priceCents;
  const isLast = index === total - 1;
  return (
    // Mounted once per reveal sequence: later pulls swap the content in place
    // instead of re-running the entrance (which made the card bob on every Next).
    <Animated.View
      key="revealed"
      entering={FadeInDown.delay(300).duration(320)}
      style={[styles.panel, styles.card]}
      testID="reveal-card"
    >
      <View style={styles.headerRow}>
        <RarityBadge rarity={watch.rarity} />
        {multi ? (
          <Text variant="caption" color={colors.textMuted} style={styles.flex}>
            {'  '}
            {index + 1} of {total}
          </Text>
        ) : (
          <View style={styles.flex} />
        )}
        <IconButton name="share" accessibilityLabel="Share this pull" onPress={onShare} testID="opening-share" />
      </View>
      <Text variant="title" testID="revealed-name">
        {watch.brand} {watch.name}
      </Text>
      <View style={styles.revealRow}>
        <Text variant="mono" color={colors.gold}>
          {formatMoney(watch.valueCents)}
        </Text>
        <Text variant="caption" color={multiple >= 1 ? colors.success : colors.textMuted}>
          {multiple >= 1 ? `${multiple.toFixed(1)}× the box price` : 'Better luck next time'}
        </Text>
      </View>

      {multi ? (
        <Button
          testID="opening-next"
          title={isLast ? `See all ${total}` : 'Next pull'}
          subtitle={isLast ? undefined : `${total - index - 1} left`}
          tint={box.theme.accent}
          onPress={onNext}
        />
      ) : (
        <>
          <View style={styles.actions}>
            <Button
              testID="opening-sell"
              title={sale.soldCents != null ? 'Sold' : `Sell ${formatMoney(sellOfferCents)}`}
              subtitle={sale.soldCents != null ? `+${formatMoney(sale.soldCents)}` : undefined}
              variant="secondary"
              loading={sale.selling}
              disabled={sale.soldCents != null}
              onPress={onSell}
              style={styles.actionButton}
            />
            <Button
              testID="opening-keep"
              title={sale.soldCents != null ? 'Done' : 'Keep'}
              variant="secondary"
              onPress={onKeep}
              style={styles.actionButton}
            />
          </View>
          <Button
            testID="opening-again"
            title="Open again"
            subtitle={formatMoney(box.priceCents)}
            tint={box.theme.accent}
            onPress={onOpenAgain}
          />
        </>
      )}
    </Animated.View>
  );
}

// ------------------------------------------------------------------ summary

export function SummaryCard({
  box,
  results,
  watchesById,
  sales,
  sellOffer,
  bulkSelling,
  onSell,
  onSellCommons,
  onKeep,
  onOpenAgain,
  onShare,
}: {
  box: Box;
  results: OwnedWatch[];
  watchesById: Record<string, Watch>;
  sales: Record<string, SaleState>;
  sellOffer: (watch: Watch) => number;
  bulkSelling: boolean;
  onSell: (item: OwnedWatch) => void;
  onSellCommons: () => void;
  onKeep: () => void;
  onOpenAgain: () => void;
  onShare: () => void;
}) {
  const paid = box.priceCents * results.length;
  const totalValue = results.reduce((sum, r) => sum + (watchesById[r.watchId]?.valueCents ?? 0), 0);
  const net = totalValue - paid;
  const unsoldCommons = results.filter(
    r => watchesById[r.watchId]?.rarity === 'common' && sales[r.instanceId]?.soldCents == null,
  );
  const commonsOffer = unsoldCommons.reduce((sum, r) => sum + sellOffer(watchesById[r.watchId]), 0);
  const anySold = results.some(r => sales[r.instanceId]?.soldCents != null);
  // Best pull first in the recap.
  const rows = [...results].reverse();

  return (
    <Animated.View key="summary" entering={FadeIn.duration(250)} style={[styles.panel, styles.card]} testID="summary-card">
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text variant="overline" color={colors.textMuted}>
            Your {results.length} pulls
          </Text>
          <Text variant="title">{formatMoney(totalValue)}</Text>
        </View>
        <IconButton name="share" accessibilityLabel="Share your best pull" onPress={onShare} />
      </View>
      <Text variant="caption" color={net >= 0 ? colors.success : colors.textMuted}>
        Paid {formatMoney(paid)} · {net >= 0 ? '+' : '−'}
        {formatMoney(Math.abs(net))} {net >= 0 ? 'ahead' : 'behind'}
      </Text>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {rows.map(item => {
          const watch = watchesById[item.watchId];
          if (!watch) {
            return null;
          }
          const sale = sales[item.instanceId] ?? { selling: false };
          const color = rarityColors[watch.rarity];
          return (
            <View key={item.instanceId} style={styles.itemRow}>
              <View style={[styles.thumb, { backgroundColor: withAlpha(color, 0.12) }]}>
                <Image source={watchThumb(watch)} style={styles.thumbImage} resizeMode="contain" />
              </View>
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {watch.name}
                </Text>
                <Text variant="caption" color={color}>
                  {formatMoney(watch.valueCents)}
                </Text>
              </View>
              {sale.soldCents != null ? (
                <Text variant="caption" color={colors.success}>
                  Sold +{formatMoney(sale.soldCents)}
                </Text>
              ) : (
                <Button
                  title={`Sell ${formatMoney(sellOffer(watch))}`}
                  variant="secondary"
                  loading={sale.selling}
                  disabled={bulkSelling}
                  onPress={() => onSell(item)}
                  style={styles.smallButton}
                />
              )}
            </View>
          );
        })}
      </ScrollView>

      {unsoldCommons.length > 1 ? (
        <Button
          testID="summary-sell-commons"
          title={`Sell ${unsoldCommons.length} commons`}
          subtitle={`+${formatMoney(commonsOffer)}`}
          variant="secondary"
          loading={bulkSelling}
          onPress={onSellCommons}
        />
      ) : null}
      <View style={styles.actions}>
        <Button
          testID="opening-keep"
          title={anySold ? 'Done' : 'Keep all'}
          variant="secondary"
          onPress={onKeep}
          style={styles.actionButton}
        />
        <Button
          testID="opening-again"
          title={`Open ${results.length} again`}
          subtitle={formatMoney(paid)}
          tint={box.theme.accent}
          onPress={onOpenAgain}
          style={styles.actionButton}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md },
  card: {
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(19,19,23,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  compact: { padding: spacing.lg, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  revealRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  actionButton: { flex: 1, paddingHorizontal: spacing.md },
  list: { maxHeight: 230 },
  listContent: { gap: spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 44, height: 50, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  thumbImage: { height: 44, aspectRatio: 1019 / 1544 },
  smallButton: { minHeight: 36, paddingHorizontal: spacing.md },
});
