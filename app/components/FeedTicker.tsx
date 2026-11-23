import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { RARITY_LABEL } from '@core/common';
import { colors, radii, rarityColors, spacing, Text, withAlpha } from '@core/design-system';
import { useFeedQuery } from '@core/modules/activity';
import type { Box, Watch } from '@core/modules/catalog';

const ROTATE_MS = 3_200;

function timeAgo(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) {
    return 'just now';
  }
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}

/** One line at a time, cycling through recent notable pulls. */
export function FeedTicker({
  active,
  boxesById,
  watchesById,
}: {
  active: boolean;
  boxesById: Record<string, Box>;
  watchesById: Record<string, Watch>;
}) {
  const { data } = useFeedQuery(active);
  const entries = useMemo(() => (data ?? []).slice(0, 12), [data]);
  const [cursor, setCursor] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active || entries.length < 2) {
      return;
    }
    const id = setInterval(() => {
      setCursor(c => c + 1);
      setNow(Date.now());
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [active, entries.length]);

  // New data arrives at the front: restart from the newest pull.
  const newestId = entries[0]?.id;
  useEffect(() => setCursor(0), [newestId]);

  const entry = entries.length ? entries[cursor % entries.length] : undefined;
  const watch = entry ? watchesById[entry.watchId] : undefined;
  const box = entry ? boxesById[entry.boxId] : undefined;
  if (!entry || !watch) {
    return <View style={styles.wrap} />;
  }
  const color = rarityColors[watch.rarity];

  return (
    <View
      style={styles.wrap}
      testID="feed-ticker"
      accessible
      accessibilityLabel={`Live: ${entry.user} pulled a ${RARITY_LABEL[watch.rarity]} ${watch.name}`}
    >
      <View style={styles.live}>
        <View style={styles.liveDot} />
        <Text variant="overline" color={colors.danger}>
          Live
        </Text>
      </View>
      <Animated.View
        key={`${entry.id}-${cursor}`}
        entering={FadeInDown.duration(260)}
        exiting={FadeOutUp.duration(200)}
        style={styles.line}
      >
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text variant="caption" numberOfLines={1} style={styles.flex}>
          <Text variant="caption" color={entry.isYou ? colors.gold : colors.text}>
            {entry.user}
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            {' pulled '}
          </Text>
          <Text variant="caption" color={color}>
            {watch.name}
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            {box ? ` · ${box.name}` : ''}
          </Text>
        </Text>
        <Text variant="caption" color={colors.textFaint}>
          {timeAgo(entry.at, now)}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 36,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: withAlpha('#ffffff', 0.04),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  live: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  line: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },
  flex: { flex: 1 },
});
