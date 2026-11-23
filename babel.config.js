/** @type {import('react-native-worklets/plugin').PluginOptions} */
const workletsPluginOptions = {};

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        extensions: ['.ios.ts', '.android.ts', '.ts', '.ios.tsx', '.android.tsx', '.tsx', '.js', '.json'],
        alias: {
          '@app': './app',
          '@core': './core',
          '@stores': './stores',
          '@assets': './assets',
        },
      },
    ],
    // Must be listed last. The same plugin also transforms worklets for
    // react-native-worklets-core, which react-native-filament uses.
    ['react-native-worklets/plugin', workletsPluginOptions],
  ],
};
