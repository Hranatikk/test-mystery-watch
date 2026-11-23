import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mockApiConfig } from '@app/config/api';
import { formatMoney, isApiError, uuid } from '@core/common';
import {
  Button,
  colors,
  EmptyView,
  LoadingView,
  radii,
  RarityBadge,
  rarityColors,
  ScalePressable,
  spacing,
  Text,
  withAlpha,
} from '@core/design-system';
import type { TradeUpResponse } from '@core/modules/activity';
import { useWatchesById, useWatchesQuery, watchImage, watchThumb, type Watch } from '@core/modules/catalog';
import { isInVault, tradeUpChance, useCollectionQuery, useTradeUpMutation } from '@core/modules/collection';
import { SheetActions, SheetRow, SheetTitle, toast, useOverlayStore } from '@core/overlays';
import { haptics } from '@core/shared/haptics';
import { playSound } from '@core/shared/sound';
import { Glow } from '@app/components/Glow';
import type { CollectionScreenProps } from '@app/navigation/types';
import { ChanceBar, type ChanceBarHandle } from './ChanceBar';

const RULES = mockApiConfig.tradeUp;

type Phase = { kind: 'pick' } | { kind: 'rolling' } | { kind: 'result'; res: TradeUpResponse };

export function TradeUpScreen({ navigation, route }: CollectionScreenProps<'TradeUp'>) {
  const insets = useSafeAreaInsets();
  const { data: collection } = useCollectionQuery();
  const { data: watches } = useWatchesQuery();
  const watchesById = useWatchesById();
  const tradeUp = useTradeUpMutation();
  const bar = useRef<ChanceBarHandle>(null);

  const [selected, setSelected] = useState<string[]>(() => (route.params?.preselect ? [route.params.preselect] : []));
  const [targetId, setTargetId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' });

  const eligible = useMemo(
    () =>
      (collection ?? [])
        .filter(isInVault)
        .sort((a, b) => (watchesById?.[a.watchId]?.valueCents ?? 0) - (watchesById?.[b.watchId]?.valueCents ?? 0)),
    [collection, watchesById],
  );
  const stakeCents = selected.reduce((sum, id) => {
    const item = eligible.find(i => i.instanceId === id);
    return sum + (item ? watchesById?.[item.watchId]?.valueCents ?? 0 : 0);
  }, 0);
  const targets = useMemo(
    () => [...(watches ?? [])].filter(w => w.valueCents > stakeCents).sort((a, b) => a.valueCents - b.valueCents),
    [watches, stakeCents],
  );
  const target = targets.find(w => w.id === targetId);
  const chance = target ? tradeUpChance(stakeCents, target.valueCents, RULES) : 0;

  // Keep the selection valid as the stake changes.
  useEffect(() => {
    if (targetId && !targets.some(t => t.id === targetId)) {
      setTargetId(targets[0]?.id ?? null);
    } else if (!targetId && selected.length && targets.length) {
      setTargetId(targets[0].id);
    }
  }, [targets, targetId, selected.length]);

  if (!collection || !watchesById || !watches) {
    return <LoadingView />;
  }
  if (!eligible.length && phase.kind === 'pick') {
    return <EmptyView title="Nothing to trade" message="Watches in your vault can be staked here. Open a box first." />;
  }

  const toggle = (id: string) => {
    haptics.selection();
    setSelected(s => {
      if (s.includes(id)) {
        return s.filter(x => x !== id);
      }
      if (s.length >= RULES.maxStakeItems) {
        toast.info(`Up to ${RULES.maxStakeItems} watches per trade-up`);
        return s;
      }
      return [...s, id];
    });
  };

  const run = () => {
    if (!target) {
      return;
    }
    const instanceIds = [...selected];
    const idempotencyKey = uuid();
    setPhase({ kind: 'rolling' });
    bar.current?.spin();
    haptics.medium();
    tradeUp.mutate(
      { instanceIds, targetWatchId: target.id, idempotencyKey },
      {
        onSuccess: async res => {
          await bar.current?.land(res.roll);
          if (res.won) {
            haptics.success();
            playSound('revealLegendary');
          } else {
            haptics.error();
            playSound('lose');
          }
          setSelected([]);
          setPhase({ kind: 'result', res });
        },
        onError: e => {
          bar.current?.reset();
          haptics.error();
          toast.error(isApiError(e, 'network') ? 'Network hiccup — check your vault and try again' : 'Trade-up is not available');
          setPhase({ kind: 'pick' });
        },
      },
    );
  };

  const confirm = () => {
    if (!target) {
      return;
    }
    useOverlayStore.getState().showSheet({
      key: 'confirm-tradeup',
      render: close => (
        <>
          <SheetTitle
            title={`Go for the ${target.name}?`}
            subtitle="Your staked watches are used up whatever the outcome."
          />
          <SheetRow label="Stake" value={`${selected.length} × · ${formatMoney(stakeCents)}`} />
          <SheetRow label="Target" value={formatMoney(target.valueCents)} />
          <SheetRow label="Chance" value={`${(chance * 100).toFixed(1)}%`} emphasis />
          <SheetActions>
            <Button
              testID="confirm-tradeup"
              title="Trade up"
              tint={rarityColors[target.rarity]}
              onPress={() => {
                close();
                run();
              }}
            />
            <Button title="Not now" variant="ghost" onPress={close} />
          </SheetActions>
        </>
      ),
    });
  };

  if (phase.kind === 'result') {
    return <Result res={phase.res} watchesById={watchesById} onAgain={() => setPhase({ kind: 'pick' })} onDone={() => navigation.goBack()} />;
  }

  const rolling = phase.kind === 'rolling';
  const accent = target ? rarityColors[target.rarity] : colors.gold;

  const stakeGrid = eligible.map(item => {
    const watch = watchesById[item.watchId];
    const on = selected.includes(item.instanceId);
    return watch ? (
      <ScalePressable
        key={item.instanceId}
        testID={`stake-${item.instanceId}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on, disabled: rolling }}
        accessibilityLabel={`${watch.name}, ${formatMoney(watch.valueCents)}`}
        disabled={rolling}
        onPress={() => toggle(item.instanceId)}
        style={[styles.stake, on && styles.stakeOn]}
      >
        <Image source={watchThumb(watch)} style={styles.stakeImage} resizeMode="contain" />
        <Text variant="caption" numberOfLines={1}>
          {watch.name}
        </Text>
        <Text variant="caption" color={colors.textMuted}>
          {formatMoney(watch.valueCents)}
        </Text>
        {on ? (
          <View style={styles.check}>
            <Text variant="caption" color={colors.onGold}>
              ✓
            </Text>
          </View>
        ) : null}
      </ScalePressable>
    ) : null;
  });

  return (
    <View style={styles.screen}>
      {/* Pinned: what you are going for and the odds stay visible while picking the stake below. */}
      <View style={styles.pinned}>
        <Text variant="overline" color={colors.textMuted}>
          Target
        </Text>
        {selected.length === 0 || targets.length === 0 ? (
          <View style={styles.targetHint}>
            <Text variant="caption" color={colors.textFaint}>
              {selected.length === 0
                ? 'Pick watches to stake below, then choose what to go for.'
                : 'Your stake is already worth more than any watch in the catalogue.'}
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targets}>
            {targets.map(w => (
              <TargetCard
                key={w.id}
                watch={w}
                chance={tradeUpChance(stakeCents, w.valueCents, RULES)}
                selected={w.id === targetId}
                disabled={rolling}
                onPress={() => {
                  haptics.selection();
                  setTargetId(w.id);
                }}
              />
            ))}
          </ScrollView>
        )}
        <ChanceBar ref={bar} chance={chance} accent={accent} />
        <Text variant="caption" color={colors.textFaint}>
          Chance = stake ÷ target − {Math.round(RULES.houseEdge * 100)}% edge, max {Math.round(RULES.maxChance * 100)}%. The
          stake is used up either way.
        </Text>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        scrollEnabled={!rolling}
      >
        <Text variant="overline" color={colors.textMuted}>
          Your stake · {selected.length}/{RULES.maxStakeItems} · {formatMoney(stakeCents)}
        </Text>
        <View style={styles.grid}>{stakeGrid}</View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          testID="trade-up-go"
          title={rolling ? 'Rolling…' : 'Trade up'}
          subtitle={target ? `${(chance * 100).toFixed(1)}% for ${formatMoney(target.valueCents)}` : 'Pick a stake and a target'}
          tint={accent}
          disabled={!target || rolling}
          onPress={confirm}
        />
      </View>
    </View>
  );
}

function TargetCard({
  watch,
  chance,
  selected,
  disabled,
  onPress,
}: {
  watch: Watch;
  chance: number;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const color = rarityColors[watch.rarity];
  return (
    <ScalePressable
      testID={`target-${watch.id}`}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${watch.name}, ${(chance * 100).toFixed(1)}% chance`}
      disabled={disabled}
      onPress={onPress}
      style={[styles.target, selected && { borderColor: color, backgroundColor: withAlpha(color, 0.1) }]}
    >
      <Image source={watchThumb(watch)} style={styles.targetImage} resizeMode="contain" />
      <RarityBadge rarity={watch.rarity} size="sm" />
      <Text variant="caption" numberOfLines={1}>
        {watch.name}
      </Text>
      <Text variant="mono" color={color}>
        {(chance * 100).toFixed(1)}%
      </Text>
    </ScalePressable>
  );
}

function Result({
  res,
  watchesById,
  onAgain,
  onDone,
}: {
  res: TradeUpResponse;
  watchesById: Record<string, Watch>;
  onAgain: () => void;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const won = res.won && res.item ? watchesById[res.item.watchId] : undefined;
  const color = won ? rarityColors[won.rarity] : colors.textMuted;
  return (
    <View style={[styles.screen, styles.result, { paddingBottom: insets.bottom + spacing.lg }]} testID="trade-up-result">
      <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.resultHero}>
        <Glow color={won ? color : colors.danger} size={420} intensity={won ? 0.6 : 0.2} />
        {won ? <Image source={watchImage(won)} style={styles.resultImage} resizeMode="contain" /> : null}
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(250)} style={styles.resultBody}>
        <Text variant="display" align="center">
          {won ? 'You got it' : 'Not this time'}
        </Text>
        <Text variant="body" color={colors.textMuted} align="center">
          {won
            ? `${won.brand} ${won.name} is in your vault.`
            : `The needle stopped at ${(res.roll * 100).toFixed(1)}%. You needed under ${(res.chance * 100).toFixed(1)}%.`}
        </Text>
        <Button title="Try another" variant="secondary" onPress={onAgain} />
        <Button title="Done" tint={won ? color : undefined} onPress={onDone} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.sm },
  pinned: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  // Same height as the target row, so picking the first watch doesn't shift the layout.
  targetHint: { height: 150, justifyContent: 'center' },
  stakeOn: { borderColor: colors.gold, backgroundColor: withAlpha(colors.gold, 0.1) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stake: {
    width: '31.5%',
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 2,
  },
  stakeImage: { height: 64, aspectRatio: 1019 / 1544 },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targets: { gap: spacing.sm, paddingVertical: spacing.xs, height: 150 },
  target: {
    width: 120,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 4,
  },
  targetImage: { height: 64, aspectRatio: 1019 / 1544 },
  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  result: { justifyContent: 'center', padding: spacing.xl },
  resultHero: { height: 340, alignItems: 'center', justifyContent: 'center' },
  resultImage: { height: 300, aspectRatio: 1019 / 1544 },
  resultBody: { gap: spacing.md },
});
