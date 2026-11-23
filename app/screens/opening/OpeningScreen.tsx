import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused, usePreventRemove } from '@react-navigation/native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mockApiConfig } from '@app/config/api';
import { isApiError, type Rarity } from '@core/common';
import { colors, IconButton, LoadingView, rarityColors, spacing, Text, withAlpha } from '@core/design-system';
import { usePityQuery } from '@core/modules/activity';
import { useBoxQuery, useWatchesById, type Watch } from '@core/modules/catalog';
import {
  useCollectionQuery,
  useMarkRevealedMutation,
  useSellBackMutation,
  type OwnedWatch,
} from '@core/modules/collection';
import { currentResult, isLocked, type OpeningState } from '@core/modules/opening';
import { toast } from '@core/overlays';
import { queryKeys } from '@core/shared/api';
import { useQueryClient } from '@tanstack/react-query';
import { BoxView } from '@core/scene';
import { haptics } from '@core/shared/haptics';
import { playSound, type SoundName } from '@core/shared/sound';
import { useOpeningStore } from '@stores/openingStore';
import { useSettingsStore } from '@stores/settingsStore';
import { BalanceBadge } from '@app/components/BalanceBadge';
import { CoachMark } from '@app/components/CoachMark';
import { Glow } from '@app/components/Glow';
import type { OpenCount } from '@app/components/QuantityPicker';
import { ShareCard, shareCard } from '@app/components/ShareCard';
import { openConfirmPurchaseSheet, openInsufficientFundsSheet } from '@app/components/sheets';
import type { RootScreenProps } from '@app/navigation/types';
import {
  ErrorPanel,
  InspectPanel,
  PurchasingPanel,
  ReadyPanel,
  RevealCard,
  SummaryCard,
  type SaleState,
} from './OpeningControls';
import { RevealOverlay } from './RevealOverlay';
import {
  LID_OPEN_SPRING,
  nearestRestYaw,
  SOFT_SPRING,
  useOpeningGestures,
  type OpeningSharedValues,
} from './useOpeningGestures';

/** Slightly more frontal than the catalogue ¾ view so the cushion is visible. */
const PRESENT_YAW_OFFSET = -0.35;
/** Rotation (rad) that counts as "the user has learnt to spin the box". */
const SPIN_LEARNT = 1.2;
const EMPTY: OwnedWatch[] = [];

const REVEAL_HAPTICS: Record<Rarity, () => void> = {
  common: haptics.light,
  rare: haptics.medium,
  epic: haptics.heavy,
  legendary: haptics.success,
};
const REVEAL_SOUNDS: Record<Rarity, SoundName> = {
  common: 'revealCommon',
  rare: 'revealRare',
  epic: 'revealEpic',
  legendary: 'revealLegendary',
};

const sellOffer = (watch: Watch) => Math.round(watch.valueCents * mockApiConfig.sellBackRatio);

export function OpeningScreen({ route, navigation }: RootScreenProps<'Opening'>) {
  const { boxId, instanceId } = route.params;
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const { data: box } = useBoxQuery(boxId);
  const watchesById = useWatchesById();
  const queryClient = useQueryClient();
  // Read once on entry (resuming an unopened pull). Staying subscribed would
  // re-render this whole screen on every markRevealed/sell mid-animation.
  const [entered, setEntered] = useState(false);
  const { data: collection } = useCollectionQuery({ subscribed: Boolean(instanceId) && !entered });
  const { data: pity } = usePityQuery();
  const markRevealed = useMarkRevealedMutation();
  const sellBack = useSellBackMutation();

  const machine = useOpeningStore(s => s.machine);
  const send = useOpeningStore(s => s.send);
  const purchase = useOpeningStore(s => s.purchase);
  const retry = useOpeningStore(s => s.retry);
  const onboarding = useSettingsStore(s => s.onboarding);
  const completeOnboarding = useSettingsStore(s => s.completeOnboarding);

  const [count, setCount] = useState<OpenCount>(1);
  const [sales, setSales] = useState<Record<string, SaleState>>({});
  const [bulkSelling, setBulkSelling] = useState(false);
  const shareRef = useRef<View>(null);

  // ------------------------------------------------------------ enter / exit
  useEffect(() => {
    if (entered) {
      return;
    }
    if (instanceId) {
      const pending = useOpeningStore.getState().pendingReveal;
      let results: OwnedWatch[] | undefined;
      if (pending?.results.some(r => r.instanceId === instanceId)) {
        results = pending.results;
      } else if (collection) {
        // Same purchase = same box and timestamp; the server keeps reveal order.
        const item = collection.find(i => i.instanceId === instanceId);
        results = item
          ? collection.filter(i => !i.revealed && i.boxId === item.boxId && i.acquiredAt === item.acquiredAt)
          : undefined;
      }
      if (!results?.length) {
        return; // wait for the collection to load
      }
      send({ type: 'RESUME', boxId, results });
    } else {
      send({ type: 'INSPECT', boxId });
    }
    setEntered(true);
  }, [entered, boxId, instanceId, collection, send]);

  useEffect(
    () => () => {
      const { pendingReveal } = useOpeningStore.getState();
      if (pendingReveal) {
        toast.info(
          pendingReveal.results.length > 1
            ? `${pendingReveal.results.length} unopened pulls are waiting in Collection`
            : 'Your box is waiting in Collection',
        );
      }
      useOpeningStore.getState().send({ type: 'EXIT' });
    },
    [],
  );

  // ------------------------------------------------------------ navigation lock
  const locked = isLocked(machine);
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !locked });
  }, [locked, navigation]);
  usePreventRemove(locked, () => {
    haptics.warning();
    toast.info(machine.status === 'purchasing' ? 'Finishing your payment…' : 'Let go of the lid first');
  });

  // ------------------------------------------------------------ shared values
  const lid = useSharedValue(0);
  const yaw = useSharedValue(0);
  const pitch = useSharedValue(0);
  const zoom = useSharedValue(1);
  const status = useSharedValue(machine.status);
  const values: OpeningSharedValues = useMemo(
    () => ({ lid, yaw, pitch, zoom, status }),
    [lid, yaw, pitch, zoom, status],
  );

  /** Spring back to the ¾ presentation pose (nearest turn, so no full spin). */
  const presentPose = useCallback(
    (opts?: { keepZoom?: boolean }) => {
      cancelAnimation(yaw);
      cancelAnimation(pitch);
      yaw.value = withSpring(nearestRestYaw(yaw.value) + PRESENT_YAW_OFFSET, SOFT_SPRING);
      pitch.value = withSpring(0, SOFT_SPRING);
      if (!opts?.keepZoom) {
        zoom.value = withSpring(1, SOFT_SPRING);
      }
    },
    [yaw, pitch, zoom],
  );

  const results = 'results' in machine ? machine.results : EMPTY;
  const current = currentResult(machine);
  const watch = current && watchesById ? watchesById[current.watchId] : undefined;
  const index = machine.status === 'revealed' ? machine.index : 0;
  const best = results.length && watchesById ? watchesById[results[results.length - 1].watchId] : undefined;

  // React to state changes: animations + haptics + side effects.
  const prevStatus = useRef<OpeningState['status']>(machine.status);
  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = machine.status;
    status.value = machine.status;

    switch (machine.status) {
      case 'inspecting':
        if (prev === 'revealed' || prev === 'summary') {
          lid.value = withTiming(0, { duration: 450, easing: Easing.inOut(Easing.cubic) });
          setSales({});
        }
        break;
      case 'ready':
        if (prev === 'purchasing') {
          haptics.success();
          playSound('purchase');
        }
        if (prev !== 'opening') {
          presentPose();
        }
        break;
      case 'revealed':
        markRevealed.mutate(machine.results[machine.index].instanceId);
        break;
      case 'error':
        haptics.error();
        if (machine.reason === 'funds' && box) {
          send({ type: 'DISMISS_ERROR' });
          openInsufficientFundsSheet(box.priceCents * machine.count);
        }
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machine]);

  // Reveal feedback for every pull, once the watch is known and on screen.
  const revealedId = machine.status === 'revealed' ? current?.instanceId : undefined;
  useEffect(() => {
    if (!revealedId || !watch) {
      return;
    }
    // Later pulls of a multi-open rise on a timer; land the sound with them.
    const delay = index > 0 ? 380 : 0;
    const timer = setTimeout(() => {
      REVEAL_HAPTICS[watch.rarity]();
      playSound(REVEAL_SOUNDS[watch.rarity]);
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedId]);

  // ------------------------------------------------------------ onboarding
  const showSpinCoach = machine.status === 'inspecting' && !onboarding.spin;
  const showLidCoach = machine.status === 'ready' && !onboarding.lid;
  const completeSpin = useCallback(() => completeOnboarding('spin'), [completeOnboarding]);
  useAnimatedReaction(
    () => Math.abs(yaw.value) > SPIN_LEARNT,
    (learnt, prev) => {
      if (showSpinCoach && learnt && !prev) {
        runOnJS(completeSpin)();
      }
    },
    [showSpinCoach],
  );

  // ------------------------------------------------------------ lid callbacks
  const lidCallbacks = useMemo(
    () => ({
      onLidGrab: () => {
        haptics.light();
        playSound('lidGrab', 0.7);
        completeOnboarding('lid');
        send({ type: 'LID_GRABBED' });
        presentPose({ keepZoom: true });
      },
      onLidCommit: () => {
        haptics.medium();
        playSound('lidOpen');
        send({ type: 'LID_OPENED' });
      },
      onLidRelease: () => send({ type: 'LID_RELEASED' }),
      onLidSettled: () => undefined,
      onResetPose: () => {
        haptics.selection();
        presentPose();
      },
    }),
    [send, presentPose, completeOnboarding],
  );
  const gesture = useOpeningGestures(values, lidCallbacks);

  const openForMe = useCallback(() => {
    if (useOpeningStore.getState().machine.status !== 'ready') {
      return;
    }
    haptics.medium();
    playSound('lidOpen');
    completeOnboarding('lid');
    send({ type: 'LID_GRABBED' });
    lid.value = withSpring(1, LID_OPEN_SPRING, finished => {
      if (finished) {
        runOnJS(send)({ type: 'LID_OPENED' });
      }
    });
  }, [lid, send, completeOnboarding]);

  // ------------------------------------------------------------ actions
  const startPurchase = useCallback(
    (n: OpenCount) => {
      if (!box) {
        return;
      }
      const total = box.priceCents * n;
      // Read at tap time instead of subscribing: the badge shows the balance,
      // the screen itself doesn't need to re-render when it changes.
      const balance = queryClient.getQueryData<number>(queryKeys.balance);
      const confirm = () =>
        openConfirmPurchaseSheet({
          boxName: n > 1 ? `${n} × ${box.name}` : box.name,
          priceCents: total,
          balanceCents: balance ?? 0,
          tint: box.theme.accent,
          onConfirm: () => {
            haptics.medium();
            purchase(n);
          },
        });
      if (balance != null && balance < total) {
        haptics.warning();
        openInsufficientFundsSheet(total, confirm);
        return;
      }
      confirm();
    },
    [box, purchase, queryClient],
  );

  const next = useCallback(() => {
    haptics.selection();
    playSound('next', 0.6);
    send({ type: 'REVEAL_NEXT' });
  }, [send]);

  const sellItems = useCallback(
    async (items: OwnedWatch[]) => {
      let credited = 0;
      for (const item of items) {
        setSales(s => ({ ...s, [item.instanceId]: { selling: true } }));
        try {
          const res = await sellBack.mutateAsync(item.instanceId);
          credited += res.creditedCents;
          setSales(s => ({ ...s, [item.instanceId]: { selling: false, soldCents: res.creditedCents } }));
        } catch (e) {
          setSales(s => ({ ...s, [item.instanceId]: { selling: false } }));
          haptics.error();
          toast.error(isApiError(e, 'network') ? 'Network hiccup, try again' : 'Could not sell this watch');
          break;
        }
      }
      if (credited > 0) {
        haptics.success();
        playSound('sell');
      }
    },
    [sellBack],
  );

  const sellCommons = useCallback(async () => {
    if (!watchesById) {
      return;
    }
    setBulkSelling(true);
    await sellItems(
      results.filter(r => watchesById[r.watchId]?.rarity === 'common' && sales[r.instanceId]?.soldCents == null),
    );
    setBulkSelling(false);
  }, [results, sales, sellItems, watchesById]);

  const keep = useCallback(() => {
    const kept = results.filter(r => sales[r.instanceId]?.soldCents == null).length;
    if (kept > 0) {
      toast.success(kept > 1 ? `${kept} watches added to your collection` : 'Added to your collection');
    }
    navigation.goBack();
  }, [navigation, results, sales]);

  const openAgain = useCallback(() => {
    const n = (results.length || 1) as OpenCount;
    setCount(n);
    send({ type: 'INSPECT', boxId });
    startPurchase(n);
  }, [results.length, send, boxId, startPurchase]);

  const share = useCallback(async () => {
    const target = machine.status === 'summary' ? best : watch;
    if (target) {
      haptics.selection();
      await shareCard(shareRef, target);
    }
  }, [machine.status, best, watch]);

  const close = useCallback(() => {
    if (!locked) {
      navigation.goBack();
    }
  }, [locked, navigation]);

  // ------------------------------------------------------------ backdrop
  const revealTint = useSharedValue(0);
  const tinted = machine.status === 'revealed' || machine.status === 'summary';
  useEffect(() => {
    revealTint.value = withTiming(tinted ? 1 : 0, { duration: 600 });
  }, [tinted, revealTint]);
  const rarityGlowStyle = useAnimatedStyle(() => ({ opacity: revealTint.value }));
  const boxGlowStyle = useAnimatedStyle(() => ({ opacity: 1 - revealTint.value * 0.7 }));

  if (!box || !watchesById) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <LoadingView />
      </View>
    );
  }

  const accent = box.theme.accent;
  const glowWatch = machine.status === 'summary' ? best : watch;
  const rarityColor = glowWatch ? rarityColors[glowWatch.rarity] : accent;
  const showWatch = watch && (machine.status === 'opening' || machine.status === 'revealed' || machine.status === 'ready');
  const shareWatch = machine.status === 'summary' ? best : machine.status === 'revealed' ? watch : undefined;

  const renderControls = () => {
    switch (machine.status) {
      case 'idle':
      case 'inspecting':
        return (
          <InspectPanel
            box={box}
            count={count}
            onCountChange={setCount}
            pityCount={pity ? pity[box.id] ?? 0 : undefined}
            onBuy={() => startPurchase(count)}
          />
        );
      case 'purchasing':
        return <PurchasingPanel accent={accent} count={machine.count} />;
      case 'error':
        return <ErrorPanel accent={accent} onRetry={retry} onCancel={() => send({ type: 'DISMISS_ERROR' })} />;
      case 'ready':
      case 'opening':
        return (
          <ReadyPanel
            accent={accent}
            count={results.length}
            disabled={machine.status === 'opening'}
            onOpenForMe={openForMe}
          />
        );
      case 'revealed':
        return watch ? (
          <RevealCard
            box={box}
            watch={watch}
            index={index}
            total={results.length}
            sale={sales[current!.instanceId] ?? { selling: false }}
            sellOfferCents={sellOffer(watch)}
            onNext={next}
            onSell={() => sellItems([current!])}
            onKeep={keep}
            onOpenAgain={openAgain}
            onShare={share}
          />
        ) : null;
      case 'summary':
        return (
          <SummaryCard
            box={box}
            results={results}
            watchesById={watchesById}
            sales={sales}
            sellOffer={sellOffer}
            bulkSelling={bulkSelling}
            onSell={item => sellItems([item])}
            onSellCommons={sellCommons}
            onKeep={keep}
            onOpenAgain={openAgain}
            onShare={share}
          />
        );
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: box.theme.backdrop }]} testID="opening-screen">
      {/* Backdrop lights */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, boxGlowStyle]} pointerEvents="none">
        <Glow color={accent} size={560} intensity={0.35} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, rarityGlowStyle]} pointerEvents="none">
        <Glow color={rarityColor} size={640} intensity={0.45} />
      </Animated.View>

      {/* 3D stage */}
      <GestureDetector gesture={gesture}>
        <View style={styles.stage} testID="opening-stage">
          <BoxView
            theme={box.theme}
            lidProgress={lid}
            yaw={yaw}
            pitch={pitch}
            zoom={zoom}
            active={isFocused}
            margin={1.25}
            elevation={0.38}
            style={StyleSheet.absoluteFill}
          />
          {showWatch ? (
            <RevealOverlay
              key={current!.instanceId}
              watch={watch}
              lid={lid}
              revealed={machine.status === 'revealed'}
              entrance={machine.status === 'revealed' && index > 0}
            />
          ) : null}
          {showSpinCoach ? <CoachMark kind="dragX" label="Drag to spin the box" accent={accent} /> : null}
          {showLidCoach ? <CoachMark kind="swipeUp" label="Swipe up on the lid to open it" accent={accent} /> : null}
        </View>
      </GestureDetector>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <IconButton
          testID="opening-close"
          name="close"
          accessibilityLabel="Close"
          onPress={close}
          disabled={locked}
        />
        <View style={styles.title} pointerEvents="none">
          <Text variant="overline" color={withAlpha(accent, 0.9)}>
            Mystery box
          </Text>
          <Text variant="heading">{box.name}</Text>
        </View>
        <BalanceBadge />
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]} pointerEvents="box-none">
        {renderControls()}
      </View>

      {shareWatch ? <ShareCard ref={shareRef} watch={shareWatch} boxName={box.name} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  stage: { ...StyleSheet.absoluteFillObject },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  title: { alignItems: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg },
});
