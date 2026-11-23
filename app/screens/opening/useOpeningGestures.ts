import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  runOnJS,
  useSharedValue,
  withDecay,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { clamp } from '@core/common';
import type { OpeningStatus } from '@core/modules/opening';

export const LID_COMMIT_THRESHOLD = 0.35;
const ROTATE_PER_PX = 0.011;
const PITCH_PER_PX = 0.007;
/**
 * Added to the base camera elevation (~0.38 rad on the opening screen).
 * The lower bound puts the camera ~75° below the box so the underside is
 * visible; both bounds stay clear of ±90° where `lookAt` with a +Y up vector
 * degenerates.
 */
export const PITCH_RANGE = [-1.68, 0.92] as const;
const ZOOM_RANGE = [0.8, 1.6] as const;
const ZOOM_REST_RANGE = [0.9, 1.4] as const;

export const SOFT_SPRING = { damping: 18, stiffness: 110, mass: 1 };
export const LID_OPEN_SPRING = { damping: 13, stiffness: 95, mass: 1 };
export const LID_CLOSE_SPRING = { damping: 20, stiffness: 180, mass: 1 };

export type OpeningSharedValues = {
  lid: SharedValue<number>;
  yaw: SharedValue<number>;
  pitch: SharedValue<number>;
  zoom: SharedValue<number>;
  status: SharedValue<OpeningStatus>;
};

export type LidCallbacks = {
  onLidGrab: () => void;
  onLidCommit: () => void;
  onLidRelease: () => void;
  onLidSettled: () => void;
  onResetPose: () => void;
};

/** Nearest full turn, so the box springs back to its ¾ pose without spinning around. */
export function nearestRestYaw(yaw: number): number {
  'worklet';
  const turn = Math.PI * 2;
  return Math.round(yaw / turn) * turn;
}

/**
 * Pan: free orbit. Yaw keeps its momentum and stays where it lands; pitch
 * (camera elevation) decays inside PITCH_RANGE, so the user can look at the
 * underside and it stays there. In `ready`, an upward vertical drag grabs the
 * lid instead and maps finger travel to lid progress (the screen springs the
 * box back to its presentation pose on grab).
 * Double tap: back to the presentation pose.
 * Pinch: bounded zoom.
 */
export function useOpeningGestures(values: OpeningSharedValues, callbacks: LidCallbacks) {
  const { height } = useWindowDimensions();
  const dragDistance = height * 0.3;

  const mode = useSharedValue<0 | 1 | 2>(0); // none | rotate | lid
  const startYaw = useSharedValue(0);
  const startPitch = useSharedValue(0);
  const startZoom = useSharedValue(1);

  return useMemo(() => {
    const { lid, yaw, pitch, zoom, status } = values;
    const { onLidGrab, onLidCommit, onLidRelease, onLidSettled, onResetPose } = callbacks;

    const pan = Gesture.Pan()
      .minDistance(6)
      .maxPointers(1)
      .onStart(e => {
        const s = status.value;
        const vertical = Math.abs(e.translationY) > Math.abs(e.translationX);
        if (s === 'ready' && vertical && e.translationY < 0) {
          mode.value = 2;
          runOnJS(onLidGrab)();
        } else if (s === 'inspecting' || s === 'ready' || s === 'error') {
          mode.value = 1;
          cancelAnimation(yaw);
          cancelAnimation(pitch);
          startYaw.value = yaw.value;
          startPitch.value = pitch.value;
        } else {
          mode.value = 0;
        }
      })
      .onUpdate(e => {
        if (mode.value === 1) {
          yaw.value = startYaw.value + e.translationX * ROTATE_PER_PX;
          pitch.value = clamp(startPitch.value + e.translationY * PITCH_PER_PX, PITCH_RANGE[0], PITCH_RANGE[1]);
        } else if (mode.value === 2) {
          lid.value = clamp(-e.translationY / dragDistance, 0, 1);
        }
      })
      .onEnd(e => {
        if (mode.value === 1) {
          yaw.value = withDecay({ velocity: e.velocityX * ROTATE_PER_PX, deceleration: 0.994 });
          pitch.value = withDecay({
            velocity: e.velocityY * PITCH_PER_PX,
            deceleration: 0.99,
            clamp: [PITCH_RANGE[0], PITCH_RANGE[1]],
          });
        } else if (mode.value === 2) {
          const commit = lid.value > LID_COMMIT_THRESHOLD || e.velocityY < -900;
          if (commit) {
            runOnJS(onLidCommit)();
            lid.value = withSpring(1, LID_OPEN_SPRING, finished => {
              if (finished) {
                runOnJS(onLidSettled)();
              }
            });
          } else {
            lid.value = withSpring(0, LID_CLOSE_SPRING);
            runOnJS(onLidRelease)();
          }
        }
        mode.value = 0;
      })
      .onFinalize(() => {
        // Cancelled mid-drag (system gesture, interruption): close the lid again.
        if (mode.value === 2) {
          lid.value = withSpring(0, LID_CLOSE_SPRING);
          runOnJS(onLidRelease)();
        }
        mode.value = 0;
      });

    const pinch = Gesture.Pinch()
      .onStart(() => {
        startZoom.value = zoom.value;
      })
      .onUpdate(e => {
        const s = status.value;
        if (s === 'inspecting' || s === 'ready' || s === 'error') {
          zoom.value = clamp(startZoom.value * e.scale, ZOOM_RANGE[0], ZOOM_RANGE[1]);
        }
      })
      .onEnd(() => {
        zoom.value = withSpring(clamp(zoom.value, ZOOM_REST_RANGE[0], ZOOM_REST_RANGE[1]), SOFT_SPRING);
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((_e, success) => {
        const s = status.value;
        if (success && (s === 'inspecting' || s === 'ready' || s === 'error')) {
          runOnJS(onResetPose)();
        }
      });

    return Gesture.Simultaneous(pan, pinch, doubleTap);
  }, [values, callbacks, dragDistance, mode, startYaw, startPitch, startZoom]);
}
