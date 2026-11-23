import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMoney } from '@core/common';
import { Button, colors, ErrorView, LoadingView, spacing, Text, withAlpha } from '@core/design-system';
import { usePityQuery } from '@core/modules/activity';
import { boxOdds, expectedValueCents, useBoxQuery, useWatchesById } from '@core/modules/catalog';
import { BoxView } from '@core/scene';
import { Glow } from '@app/components/Glow';
import { OddsList } from '@app/components/OddsList';
import { PityMeter } from '@app/components/PityMeter';
import { useRootNavigation } from '@app/navigation/hooks';
import type { CatalogueScreenProps } from '@app/navigation/types';

export function BoxDetailsScreen({ route }: CatalogueScreenProps<'BoxDetails'>) {
  const rootNavigation = useRootNavigation();
  const { boxId } = route.params;
  const { data: box, isLoading, error, refetch } = useBoxQuery(boxId);
  const watchesById = useWatchesById();
  const { data: pity } = usePityQuery();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  // The header is transparent, so content must start below it (status bar / Dynamic Island + nav bar).
  const headerHeight = useHeaderHeight();

  const odds = useMemo(() => (box && watchesById ? boxOdds(box, watchesById) : []), [box, watchesById]);
  const ev = box && watchesById ? expectedValueCents(box, watchesById) : 0;

  if (isLoading) {
    return <LoadingView />;
  }
  if (error || !box) {
    return <ErrorView message="This box is not available." onRetry={refetch} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: box.theme.backdrop }]}>
      <ScrollView contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: 120 + insets.bottom }}>
        <View style={styles.stage}>
          <Glow color={box.theme.accent} size={380} intensity={0.4} />
          <BoxView theme={box.theme} autoRotate active={isFocused} style={StyleSheet.absoluteFill} margin={1.35} />
        </View>
        <View style={styles.body}>
          <Text variant="display">{box.name}</Text>
          <Text variant="body" color={colors.textMuted}>
            {box.tagline}
          </Text>
          <View style={styles.stats}>
            <Stat label="Price" value={formatMoney(box.priceCents)} color={box.theme.accent} />
            <Stat label="Expected value" value={formatMoney(Math.round(ev))} />
            <Stat label="Top prize" value={odds[0] ? formatMoney(odds[0].watch.valueCents) : '—'} />
          </View>
          <View style={styles.pity}>
            <PityMeter box={box} pityCount={pity?.[box.id] ?? 0} />
          </View>
          <Text variant="overline" color={colors.textMuted} style={styles.section}>
            Contents & odds
          </Text>
          <OddsList odds={odds} />
          <Text variant="caption" color={colors.textFaint} style={styles.disclaimer}>
            Outcomes are rolled on the server with the weights above at the moment of payment. The guarantee overrides the roll only when its counter runs out.
          </Text>
        </View>
      </ScrollView>
      <View
        style={[
          styles.cta,
          {
            paddingBottom: insets.bottom + spacing.md,
            experimental_backgroundImage: `linear-gradient(0deg, ${box.theme.backdrop} 60%, ${withAlpha(box.theme.backdrop, 0)} 100%)`,
          },
        ]}
      >
        <Button
          testID="box-details-open"
          title="Open this box"
          subtitle={formatMoney(box.priceCents)}
          tint={box.theme.accent}
          onPress={() => rootNavigation.navigate('Opening', { boxId: box.id })}
        />
      </View>
    </View>
  );
}

function Stat({ label, value, color = colors.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="overline" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="mono" color={color}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stage: { height: 340, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  stat: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 4,
  },
  section: { marginTop: spacing.xl, marginBottom: spacing.xs },
  pity: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  disclaimer: { marginTop: spacing.md },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
});
