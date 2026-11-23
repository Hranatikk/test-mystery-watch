import React, { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '@core/design-system';

const SPRING = { damping: 22, stiffness: 240, mass: 0.9 };

/**
 * Presentational sheet. `visible=false` animates out and then calls `onClosed`.
 */
export function BottomSheet({
  visible,
  dismissible = true,
  onRequestClose,
  onClosed,
  children,
}: {
  visible: boolean;
  dismissible?: boolean;
  onRequestClose: () => void;
  onClosed: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(600);
  const translateY = useSharedValue(800);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, SPRING);
      backdrop.value = withTiming(1, { duration: 220 });
    } else {
      backdrop.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(height + 40, { duration: 220 }, finished => {
        if (finished) {
          runOnJS(onClosed)();
        }
      });
    }
  }, [visible, height, translateY, backdrop, onClosed]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dismissible) {
        onRequestClose();
      }
      return true;
    });
    return () => sub.remove();
  }, [visible, dismissible, onRequestClose]);

  const pan = Gesture.Pan()
    .enabled(dismissible)
    .activeOffsetY(8)
    .onUpdate(e => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd(e => {
      if (e.translationY > height * 0.3 || e.velocityY > 900) {
        runOnJS(onRequestClose)();
      } else {
        translateY.value = withSpring(0, SPRING);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Close"
          onPress={dismissible ? onRequestClose : undefined}
        />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View
          accessibilityViewIsModal
          onLayout={e => setHeight(e.nativeEvent.layout.height)}
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }, sheetStyle]}
        >
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: colors.overlay },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
});
