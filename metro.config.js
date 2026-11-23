const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

/**
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // 3D model + IBL environment are bundled as assets and loaded by Filament natively.
    assetExts: [...defaultConfig.resolver.assetExts, 'glb', 'ktx'],
  },
};

module.exports = mergeConfig(defaultConfig, config);
