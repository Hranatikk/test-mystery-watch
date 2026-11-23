/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import { StyleSheet, View } from 'react-native';

export type IconName = 'close' | 'back' | 'chevronUp' | 'plus' | 'box' | 'grid' | 'share';

/**
 * Tiny geometric icon set drawn with Views. Avoids pulling an icon font into a
 * bare RN app for half a dozen glyphs.
 */
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  const stroke = Math.max(1.5, size / 10);
  switch (name) {
    case 'close':
      return (
        <View style={{ width: size, height: size }}>
          <View style={[styles.bar, { width: size, height: stroke, backgroundColor: color, top: size / 2 - stroke / 2, transform: [{ rotate: '45deg' }] }]} />
          <View style={[styles.bar, { width: size, height: stroke, backgroundColor: color, top: size / 2 - stroke / 2, transform: [{ rotate: '-45deg' }] }]} />
        </View>
      );
    case 'plus':
      return (
        <View style={{ width: size, height: size }}>
          <View style={[styles.bar, { width: size, height: stroke, backgroundColor: color, top: size / 2 - stroke / 2 }]} />
          <View style={[styles.bar, { width: stroke, height: size, backgroundColor: color, left: size / 2 - stroke / 2 }]} />
        </View>
      );
    case 'back':
    case 'chevronUp': {
      const arm = size * 0.55;
      const rotate = name === 'back' ? '-45deg' : '45deg';
      return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: arm,
              height: arm,
              borderLeftWidth: stroke,
              borderTopWidth: stroke,
              borderColor: color,
              transform: [{ translateX: name === 'back' ? arm * 0.2 : 0 }, { translateY: name === 'chevronUp' ? arm * 0.2 : 0 }, { rotate }],
            }}
          />
        </View>
      );
    }
    case 'box':
      return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
          <View style={{ width: size * 0.86, height: size * 0.22, borderWidth: stroke, borderColor: color, borderRadius: 2, marginBottom: 1 }} />
          <View style={{ width: size * 0.74, height: size * 0.56, borderWidth: stroke, borderTopWidth: 0, borderColor: color, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }} />
        </View>
      );
    case 'share': {
      const arm = size * 0.34;
      return (
        <View style={{ width: size, height: size, alignItems: 'center' }}>
          <View style={{ position: 'absolute', top: size * 0.06, width: arm, height: arm, borderLeftWidth: stroke, borderTopWidth: stroke, borderColor: color, transform: [{ translateY: arm * 0.15 }, { rotate: '45deg' }] }} />
          <View style={{ position: 'absolute', top: size * 0.08, width: stroke, height: size * 0.56, backgroundColor: color, borderRadius: 1 }} />
          <View style={{ position: 'absolute', bottom: size * 0.04, width: size * 0.72, height: size * 0.42, borderWidth: stroke, borderTopWidth: 0, borderColor: color, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }} />
        </View>
      );
    }
    case 'grid': {
      const cell = (size - stroke * 2) / 2;
      return (
        <View style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', gap: stroke * 1.4 }}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={{ width: cell - stroke, height: cell - stroke, borderWidth: stroke, borderColor: color, borderRadius: 2 }} />
          ))}
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', borderRadius: 2 },
});
