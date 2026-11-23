import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMoney, probabilities } from '@core/common';
import {
  colors,
  LoadingView,
  radii,
  RarityBadge,
  rarityColors,
  ScalePressable,
  spacing,
  Text,
  withAlpha,
} from '@core/design-system';
import {
  formatProbability,
  useBoxesQuery,
  useWatchesQuery,
  watchThumb,
  type Box,
  type Watch,
} from '@core/modules/catalog';
import { useCollectionQuery } from '@core/modules/collection';
import { useWishlistStore } from '@stores/wishlistStore';
import { WishlistButton } from '@app/components/WishlistButton';
import { useOpenBoxDetails } from '@app/navigation/hooks';

type Source = { box: Box; probability: number };

/** Every box that can drop this watch, best odds first. */
function sourcesFor(watch: Watch, boxes: Box[]): Source[] {
  return boxes
    .map(box => {
      const probs = probabilities(box.contents.map(c => ({ item: c.watchId, weight: c.weight })));
      const i = box.contents.findIndex(c => c.watchId === watch.id);
      return i >= 0 ? { box, probability: probs[i] } : null;
    })
    .filter((s): s is Source => s != null)
    .sort((a, b) => b.probability - a.probability);
}

export function WishlistView() {
  const insets = useSafeAreaInsets();
  const wished = useWishlistStore(s => s.watchIds);
  const { data: watches } = useWatchesQuery();
  const { data: boxes } = useBoxesQuery();
  const { data: owned } = useCollectionQuery();
  const openBox = useOpenBoxDetails();

  const ownedCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of owned ?? []) {
      if (i.revealed) {
        counts[i.watchId] = (counts[i.watchId] ?? 0) + 1;
      }
    }
    return counts;
  }, [owned]);

  if (!watches || !boxes) {
    return <LoadingView />;
  }
  const byValueDesc = [...watches].sort((a, b) => b.valueCents - a.valueCents);
  const wishlisted = wished.map(id => watches.find(w => w.id === id)).filter((w): w is Watch => w != null);
  const others = byValueDesc.filter(w => !wished.includes(w.id));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      testID="wishlist"
    >
      {wishlisted.length === 0 ? (
        <View style={styles.hint}>
          <Text variant="heading">Your wishlist is empty</Text>
          <Text variant="body" color={colors.textMuted}>
            Tap ♡ on any watch to see which boxes can drop it and how likely that is.
          </Text>
        </View>
      ) : (
        wishlisted.map(watch => (
          <View key={watch.id} style={[styles.card, { borderColor: withAlpha(rarityColors[watch.rarity], 0.3) }]}>
            <WatchRow watch={watch} owned={ownedCount[watch.id] ?? 0} />
            <View style={styles.sources}>
              <Text variant="overline" color={colors.textMuted}>
                Where to find it
              </Text>
              {sourcesFor(watch, boxes).map(({ box, probability }) => (
                <ScalePressable
                  key={box.id}
                  testID={`wishlist-source-${watch.id}-${box.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${box.name}, ${formatProbability(probability)} chance, ${formatMoney(box.priceCents)}`}
                  onPress={() => openBox(box.id)}
                  style={styles.source}
                >
                  <View style={[styles.swatch, { backgroundColor: box.theme.accent }]} />
                  <Text variant="bodyStrong" style={styles.flex}>
                    {box.name}
                  </Text>
                  <Text variant="mono" color={rarityColors[watch.rarity]}>
                    {formatProbability(probability)}
                  </Text>
                  <Text variant="caption" color={colors.textMuted} style={styles.price}>
                    {formatMoney(box.priceCents)} ›
                  </Text>
                </ScalePressable>
              ))}
            </View>
          </View>
        ))
      )}

      {others.length ? (
        <>
          <Text variant="overline" color={colors.textMuted} style={styles.section}>
            All watches
          </Text>
          {others.map(watch => (
            <View key={watch.id} style={styles.card}>
              <WatchRow watch={watch} owned={ownedCount[watch.id] ?? 0} />
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

function WatchRow({ watch, owned }: { watch: Watch; owned: number }) {
  const color = rarityColors[watch.rarity];
  return (
    <View style={styles.row}>
      <View style={[styles.thumb, { backgroundColor: withAlpha(color, 0.1) }]}>
        <Image source={watchThumb(watch)} style={styles.image} resizeMode="contain" />
      </View>
      <View style={styles.flex}>
        <RarityBadge rarity={watch.rarity} size="sm" />
        <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
          {watch.brand} {watch.name}
        </Text>
        <Text variant="caption" color={colors.textMuted}>
          {formatMoney(watch.valueCents)}
          {owned ? ` · you own ${owned}` : ''}
        </Text>
      </View>
      <WishlistButton watchId={watch.id} label={watch.name} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  hint: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderStyle: 'dashed',
    gap: spacing.xs,
  },
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 56, height: 64, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  image: { height: 58, aspectRatio: 1019 / 1544 },
  name: { marginTop: 4 },
  flex: { flex: 1 },
  sources: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  source: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  price: { minWidth: 72, textAlign: 'right' },
  section: { marginTop: spacing.md },
});
