import HapticFeedback, { HapticFeedbackTypes } from 'react-native-haptic-feedback';

let enabled = true;

/** Called by the app layer whenever the user's preference changes. */
export function configureHaptics(options: { enabled: boolean }) {
  enabled = options.enabled;
}

const OPTIONS = { enableVibrateFallback: false, ignoreAndroidSystemSettings: false };

function trigger(type: HapticFeedbackTypes) {
  if (!enabled) {
    return;
  }
  try {
    HapticFeedback.trigger(type, OPTIONS);
  } catch {
    // Haptics are decorative; never let them break a flow.
  }
}

export const haptics = {
  selection: () => trigger(HapticFeedbackTypes.selection),
  light: () => trigger(HapticFeedbackTypes.impactLight),
  medium: () => trigger(HapticFeedbackTypes.impactMedium),
  heavy: () => trigger(HapticFeedbackTypes.impactHeavy),
  success: () => trigger(HapticFeedbackTypes.notificationSuccess),
  warning: () => trigger(HapticFeedbackTypes.notificationWarning),
  error: () => trigger(HapticFeedbackTypes.notificationError),
};
