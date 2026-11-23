/* eslint-env jest */
require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  // The mock drives animations with real timers; an infinite repeat (shimmer,
  // hints) would keep Jest alive forever. Play it once instead.
  return { ...mock, withRepeat: animation => animation };
});

jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: { trigger: jest.fn() },
  HapticFeedbackTypes: new Proxy({}, { get: (_, key) => key }),
}));

// The 3D layer needs a GPU; screens are tested with a stand-in.
jest.mock('@core/scene', () => {
  const { View } = require('react-native');
  return {
    BoxView: props => require('react').createElement(View, { testID: 'box-view', style: props.style }),
    useRenderGate: active => active,
    lidAngle: p => p,
    LID_OPEN_DEGREES: 115,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  const React = require('react');
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    SafeAreaInsetsContext: React.createContext(inset),
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets: inset, frame },
  };
});

// MMKV is a Nitro module (no native side under Jest): back our stores with memory.
jest.mock('@core/shared/persistence/mmkv', () => {
  const { createMemoryStore } = require('@core/shared/persistence/keyValueStore');
  return { clientStorage: createMemoryStore(), serverStorage: createMemoryStore() };
});

// Native media/share modules: decorative or OS-level, stubbed in tests.
jest.mock('react-native-sound', () => {
  function Sound(_src, cb) {
    if (typeof cb === 'function') {
      cb();
    }
  }
  Sound.prototype.play = jest.fn();
  Sound.prototype.stop = function (cb) {
    if (cb) {
      cb();
    }
    return this;
  };
  Sound.prototype.setVolume = function () {
    return this;
  };
  Sound.prototype.release = jest.fn();
  Sound.setCategory = jest.fn();
  return { __esModule: true, default: Sound };
});
jest.mock('react-native-share', () => ({ __esModule: true, default: { open: jest.fn(async () => ({ success: true })) } }));
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(async () => '/tmp/card.png') }));
