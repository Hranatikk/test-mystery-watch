import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  FilamentScene,
  FilamentView,
  ModelRenderer,
  useFilamentContext,
  useModel,
  useSyncSharedValue,
  useWorkletEffect,
  type RenderCallback,
} from 'react-native-filament';
import { useSharedValue as useWorkletsSharedValue, Worklets } from 'react-native-worklets-core';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { BoxLighting } from './lighting';
import { BOX_CENTER_Y, FOCAL_LENGTH_MM, frameBox } from './camera';
import { HINGED_NODES, hingeTransform, lidAngle } from './hinge';
import { applyPalette, paletteFromTheme } from './materials';
import { useRenderGate } from './useRenderGate';

const BOX_MODEL = require('@assets/models/designer-box.glb');

/** The authored front face looks down −Z; turn it towards the camera with a ¾ view. */
const BASE_YAW = Math.PI + 0.55;
const AUTO_ROTATE_RAD_PER_SEC = 0.45;

/**
 * Lets Filament drop the render resolution (down to 60%) when a frame misses
 * its budget, then climb back. Only implemented on Android, a no-op elsewhere.
 * Module-level so the Configurator effect doesn't re-run every render.
 */
const DYNAMIC_RESOLUTION = { enabled: true, minScale: [0.6, 0.6] as [number, number], quality: 'MEDIUM' as const };

export type BoxViewTheme = { body: string; seam: string };

export type BoxViewProps = {
  theme: BoxViewTheme;
  /** 0..1 → lid angle 0..115°. Also widens framing to the open bounds. */
  lidProgress?: SharedValue<number>;
  /** Radians added to the base ¾ yaw (user drag). */
  yaw?: SharedValue<number>;
  /** Radians added to camera elevation (user drag). */
  pitch?: SharedValue<number>;
  /** 1 = fitted to bounds. */
  zoom?: SharedValue<number>;
  /** Slow idle turntable, for the catalogue. */
  autoRotate?: boolean;
  /** Render gate: when false the last frame stays on screen and the GPU idles. */
  active: boolean;
  /** Extra space around the model. */
  margin?: number;
  /** Default camera elevation in radians. */
  elevation?: number;
  style?: StyleProp<ViewStyle>;
  onReady?: () => void;
};

/**
 * One box: model + lights + camera. Knows nothing about business logic.
 * Each instance owns a Filament engine, so mount only a few at a time.
 */
export const BoxView = memo(function BoxViewImpl(props: BoxViewProps) {
  const [ready, setReady] = useState(false);
  const placeholderOpacity = useSharedValue(1);

  const handleReady = useCallback(() => {
    setReady(true);
    placeholderOpacity.value = withTiming(0, { duration: 350 });
    props.onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placeholderStyle = useAnimatedStyle(() => ({ opacity: placeholderOpacity.value }));

  return (
    <View style={[styles.container, props.style]} pointerEvents="none">
      <FilamentScene dynamicResolutionOptions={DYNAMIC_RESOLUTION}>
        <BoxScene {...props} onFirstFrame={handleReady} ready={ready} />
      </FilamentScene>
      <Animated.View style={[StyleSheet.absoluteFill, styles.placeholderWrap, placeholderStyle]}>
        <View style={styles.placeholder} />
      </Animated.View>
    </View>
  );
});

type SceneProps = BoxViewProps & { onFirstFrame: () => void; ready: boolean };

function BoxScene({
  theme,
  lidProgress,
  yaw,
  pitch,
  zoom,
  autoRotate = false,
  active,
  margin = 1.3,
  elevation = 0.32,
  onFirstFrame,
  ready,
}: SceneProps) {
  const { transformManager, renderableManager, camera, view } = useFilamentContext();
  const model = useModel(BOX_MODEL);
  const asset = model.state === 'loaded' ? model.asset : undefined;

  // ---- Inputs: reanimated values (UI thread) mirrored to worklets-core (Filament thread)
  const fallbackLid = useSharedValue(0);
  const fallbackYaw = useSharedValue(0);
  const fallbackPitch = useSharedValue(0);
  const fallbackZoom = useSharedValue(1);
  const lidSV = useSyncSharedValue(lidProgress ?? fallbackLid);
  const yawSV = useSyncSharedValue(yaw ?? fallbackYaw);
  const pitchSV = useSyncSharedValue(pitch ?? fallbackPitch);
  const zoomSV = useSyncSharedValue(zoom ?? fallbackZoom);

  // ---- Per-view state living on the Filament thread
  const spin = useWorkletsSharedValue(0);
  const autoRotateSV = useWorkletsSharedValue(autoRotate);
  const gateSV = useWorkletsSharedValue(true);
  const lastAspect = useWorkletsSharedValue(0);
  const framesRendered = useWorkletsSharedValue(0);
  const marginSV = useWorkletsSharedValue(margin);
  const elevationSV = useWorkletsSharedValue(elevation);

  useEffect(() => {
    autoRotateSV.value = autoRotate;
    marginSV.value = margin;
    elevationSV.value = elevation;
  }, [autoRotate, autoRotateSV, margin, marginSV, elevation, elevationSV]);

  // ---- Node lookup (once per loaded asset)
  const nodes = useMemo(() => {
    if (!asset) {
      return undefined;
    }
    const hinged = HINGED_NODES.map(name => asset.getFirstEntityByName(name)).filter(
      e => e != null,
    );
    return { root: asset.getRoot(), hinged };
  }, [asset]);

  // ---- Material variant
  const bodyHex = theme.body;
  const seamHex = theme.seam;
  const palette = useMemo(
    () => paletteFromTheme({ body: bodyHex, seam: seamHex }),
    [bodyHex, seamHex],
  );
  useWorkletEffect(() => {
    'worklet';
    if (asset == null) {
      return;
    }
    applyPalette(renderableManager, asset, palette);
  });

  // ---- JS callbacks invoked from the render thread
  const notifyFirstFrame = useMemo(() => Worklets.createRunOnJS(onFirstFrame), [onFirstFrame]);
  const filamentRef = useRef<{ pause: () => void; resume: () => void } | null>(null);
  const gateOpen = useRenderGate(active);
  const enforcePause = useCallback(() => {
    if (!gateSV.value) {
      filamentRef.current?.pause();
    }
  }, [gateSV]);
  const requestPause = useMemo(() => Worklets.createRunOnJS(enforcePause), [enforcePause]);

  // ---- Frame loop. Dependencies are stable on purpose: changing the callback
  // makes FilamentView restart its choreographer, which would undo a pause.
  const renderCallback: RenderCallback = useCallback(
    frameInfo => {
      'worklet';
      if (nodes == null) {
        return;
      }

      if (autoRotateSV.value) {
        spin.value = (spin.value + frameInfo.timeSinceLastFrame * AUTO_ROTATE_RAD_PER_SEC) % (Math.PI * 2);
      }

      // Lid + wordmark share one hinge transform.
      const lid = lidSV.value;
      const hinge = hingeTransform(transformManager, lidAngle(lid));
      for (let i = 0; i < nodes.hinged.length; i++) {
        transformManager.setTransform(nodes.hinged[i], hinge);
      }

      // Whole model: center vertically on the closed bounds and yaw around Y.
      const rootTransform = transformManager
        .createIdentityMatrix()
        .translate([0, -BOX_CENTER_Y, 0])
        .rotate(BASE_YAW + spin.value + yawSV.value, [0, 1, 0]);
      transformManager.setTransform(nodes.root, rootTransform);

      // Camera: refit lens on resize, frame closed→open bounds as the lid moves.
      const aspect = view.getAspectRatio();
      if (aspect !== lastAspect.value) {
        lastAspect.value = aspect;
        camera.setLensProjection(FOCAL_LENGTH_MM, aspect, 0.05, 50);
      }
      const pose = frameBox(aspect, lid, zoomSV.value, elevationSV.value + pitchSV.value, marginSV.value);
      camera.lookAt(pose.eye, pose.target, [0, 1, 0]);

      const frames = framesRendered.value + 1;
      framesRendered.value = frames;
      if (frames === 2) {
        notifyFirstFrame();
      } else if (frames > 2 && !gateSV.value && frames % 30 === 0) {
        // Something (e.g. surface re-creation) restarted rendering while the gate is closed.
        requestPause();
      }
    },
    [
      nodes,
      autoRotateSV,
      spin,
      lidSV,
      transformManager,
      yawSV,
      view,
      lastAspect,
      camera,
      zoomSV,
      elevationSV,
      pitchSV,
      marginSV,
      framesRendered,
      notifyFirstFrame,
      gateSV,
      requestPause,
    ],
  );

  // ---- Render gate. Wait for the first frame so paused views still show the box.
  useEffect(() => {
    gateSV.value = gateOpen;
    if (!ready) {
      return;
    }
    if (gateOpen) {
      filamentRef.current?.resume();
    } else {
      filamentRef.current?.pause();
    }
  }, [gateOpen, ready, gateSV]);

  const filamentViewProps = { ref: filamentRef } as object;

  return (
    <FilamentView style={styles.fill} renderCallback={renderCallback} {...filamentViewProps}>
      <BoxLighting />
      <ModelRenderer model={model} />
    </FilamentView>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  fill: { flex: 1 },
  placeholderWrap: { alignItems: 'center', justifyContent: 'center' },
  placeholder: {
    width: '34%',
    aspectRatio: 1.12 / 1.12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
