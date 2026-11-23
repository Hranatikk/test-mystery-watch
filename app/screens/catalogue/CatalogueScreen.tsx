import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMoney } from '@core/common';
import { Button, colors, ErrorView, LoadingView, radii, rarityColors, spacing, Text, withAlpha } from '@core/design-system';
import {
  boxOdds,
  formatProbability,
  useBoxesQuery,
  useWatchesById,
  watchThumb,
  type Box,
} from '@core/modules/catalog';
import { haptics } from '@core/shared/haptics';
import { BoxCard } from '@app/components/BoxCard';
import { FeedTicker } from '@app/components/FeedTicker';
import { openWelcomeSheet } from '@app/components/sheets';
import { useSettingsStore } from '@stores/settingsStore';
import { useOverlayStore } from '@core/overlays';
import type { CatalogueScreenProps } from '@app/navigation/types';

const CARD_GAP = spacing.md;
/** How many neighbours on each side keep a live (paused) 3D view mounted. */
const MOUNT_RADIUS = 1;

const viewabilityConfig = { itemVisiblePercentThreshold: 35, minimumViewTime: 60 };

export function CatalogueScreen({ navigation }: CatalogueScreenProps<'Catalogue'>) {
  const { data: boxes, isLoading, error, refetch } = useBoxesQuery();
  const watchesById = useWatchesById();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const cardWidth = Math.round(width * 0.8);
  // Leaves room for the live ticker above and the prizes row below.
  const cardHeight = Math.min(Math.round(height * 0.44), Math.round(cardWidth * 1.2));
  const sideInset = (width - cardWidth) / 2;
  const snapInterval = cardWidth + CARD_GAP;

  const [visibleIds, setVisibleIds] = useState<ReadonlySet<string>>(new Set());
  const [index, setIndex] = useState(0);

  // FlatList requires a stable reference for onViewableItemsChanged.
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<Box>[] }) => {
    setVisibleIds(new Set(viewableItems.map(v => v.item.id)));
  }).current;

  const onMomentumEnd = useCallback(
    (x: number) => {
      const next = Math.round(x / snapInterval);
      setIndex(prev => {
        if (prev !== next) {
          haptics.selection();
        }
        return next;
      });
    },
    [snapInterval],
  );

  const boxesById = useMemo(() => Object.fromEntries((boxes ?? []).map(b => [b.id, b])), [boxes]);

  // First launch: a short welcome, unless something more urgent is already on screen.
  const welcomed = useSettingsStore(s => s.onboarding.welcome);
  useEffect(() => {
    if (!welcomed && boxes && !useOverlayStore.getState().sheet) {
      const timer = setTimeout(() => {
        if (!useOverlayStore.getState().sheet) {
          openWelcomeSheet(() => useSettingsStore.getState().completeOnboarding('welcome'));
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [welcomed, boxes]);

  const openBox = useCallback((boxId: string) => navigation.navigate('BoxDetails', { boxId }), [navigation]);

  const selected = boxes?.[Math.min(index, (boxes?.length ?? 1) - 1)];
  const odds = useMemo(
    () => (selected && watchesById ? boxOdds(selected, watchesById) : []),
    [selected, watchesById],
  );

  if (isLoading) {
    return <LoadingView label="Loading boxes" />;
  }
  if (error || !boxes) {
    return <ErrorView message="Couldn't load the catalogue." onRetry={refetch} />;
  }

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom > 0 ? 0 : spacing.md }]}>
      {watchesById ? <FeedTicker active={isFocused} boxesById={boxesById} watchesById={watchesById} /> : null}
      <FlatList
        testID="catalogue-pager"
        // Size to the cards; otherwise the list flex-grows and squeezes the prizes block over the dots.
        style={styles.pager}
        data={boxes}
        keyExtractor={b => b.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: sideInset, gap: CARD_GAP, paddingTop: spacing.md }}
        getItemLayout={(_, i) => ({ length: snapInterval, offset: snapInterval * i, index: i })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onMomentumScrollEnd={e => onMomentumEnd(e.nativeEvent.contentOffset.x)}
        // Keep the window tiny: each live card owns a GPU engine.
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={1}
        renderItem={({ item, index: i }) => (
          <BoxCard
            box={item}
            width={cardWidth}
            height={cardHeight}
            mount3D={Math.abs(i - index) <= MOUNT_RADIUS}
            active={isFocused && visibleIds.has(item.id)}
            onPress={openBox}
          />
        )}
      />

      <View style={styles.dots}>
        {boxes.map((b, i) => (
          <View
            key={b.id}
            style={[
              styles.dot,
              i === index && { width: 18, backgroundColor: selected?.theme.accent ?? colors.gold },
            ]}
          />
        ))}
      </View>

      {selected ? (
        <View style={styles.details}>
          <Text variant="overline" color={colors.textMuted}>
            Possible prizes
          </Text>
          <View style={styles.prizes}>
            {odds.map(({ watch, probability }) => (
              <View
                key={watch.id}
                style={[styles.prize, { borderColor: withAlpha(rarityColors[watch.rarity], 0.35) }]}
              >
                <Image source={watchThumb(watch)} style={styles.prizeImage} resizeMode="contain" />
                <Text variant="caption" color={rarityColors[watch.rarity]}>
                  {formatProbability(probability)}
                </Text>
              </View>
            ))}
          </View>
          <Button
            testID="catalogue-open"
            title={`Open ${selected.name}`}
            subtitle={formatMoney(selected.priceCents)}
            tint={selected.theme.accent}
            onPress={() => navigation.navigate('BoxDetails', { boxId: selected.id })}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  pager: { flexGrow: 0 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.lg },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  details: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.md, justifyContent: 'flex-end', paddingBottom: spacing.lg },
  prizes: { flexDirection: 'row', gap: spacing.sm },
  prize: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface,
    gap: 2,
  },
  prizeImage: { height: 46, aspectRatio: 1019 / 1544 },
});
