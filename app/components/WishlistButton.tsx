import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, ScalePressable, Text, withAlpha } from '@core/design-system';
import { haptics } from '@core/shared/haptics';
import { toast } from '@core/overlays';
import { useIsWishlisted, useWishlistStore } from '@stores/wishlistStore';

export function WishlistButton({
  watchId,
  label,
  size = 'md',
  style,
}: {
  watchId: string;
  /** Used for the accessibility label and the toast. */
  label: string;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}) {
  const active = useIsWishlisted(watchId);
  return (
    <ScalePressable
      testID={`wishlist-${watchId}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={active ? `Remove ${label} from wishlist` : `Add ${label} to wishlist`}
      hitSlop={8}
      onPress={() => {
        const added = useWishlistStore.getState().toggle(watchId);
        haptics.selection();
        if (added) {
          toast.info(`${label} added to your wishlist`);
        }
      }}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        active ? styles.active : styles.idle,
        style,
      ]}
    >
      <Text style={size === 'sm' ? styles.glyphSm : styles.glyph} color={active ? WISH : colors.textMuted}>
        {active ? '♥' : '♡'}
      </Text>
    </ScalePressable>
  );
}

const WISH = '#ff6b8a';

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  sm: { width: 32, height: 32, borderRadius: 16 },
  md: { width: 40, height: 40, borderRadius: 20 },
  active: { backgroundColor: withAlpha(WISH, 0.16), borderColor: withAlpha(WISH, 0.5) },
  idle: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: colors.border },
  glyphSm: { fontSize: 15, lineHeight: 18 },
  glyph: { fontSize: 18, lineHeight: 22 },
});
