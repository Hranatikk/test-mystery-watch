import React from 'react';
import { EnvironmentalLight, Light } from 'react-native-filament';

/**
 * The GLB ships without lights. Clearcoat (inner lid, wordmark) needs an
 * environment to reflect, otherwise it reads flat, hence IBL + a key light
 * from the upper front-left + a cool rim from behind.
 *
 * The IBL is the one bundled with react-native-filament.
 */
export const LIGHTING = {
  iblIntensity: 22_000,
  key: { intensity: 55_000, direction: [0.55, -0.75, -0.6] as [number, number, number] },
  rim: { intensity: 25_000, direction: [-0.6, -0.25, 0.9] as [number, number, number] },
};

export function BoxLighting() {
  return (
    <>
      <EnvironmentalLight source={{ uri: 'RNF_default_env_ibl.ktx' }} intensity={LIGHTING.iblIntensity} />
      <Light
        type="directional"
        intensity={LIGHTING.key.intensity}
        direction={LIGHTING.key.direction}
        colorKelvin={5_600}
        castShadows={false}
      />
      <Light
        type="directional"
        intensity={LIGHTING.rim.intensity}
        direction={LIGHTING.rim.direction}
        colorKelvin={8_000}
        castShadows={false}
      />
    </>
  );
}
