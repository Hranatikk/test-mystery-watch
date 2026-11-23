/* eslint-disable no-bitwise */
import type { FilamentAsset, Float4, RenderableManager } from 'react-native-filament';

/**
 * Material names inside designer-box.glb. Only body and seam accent are
 * re-tinted per catalogue variant; cavity, lining and wordmark stay authored.
 */
export const MATERIAL = {
  body: 'ShellRole_Body_Matte',
  seam: 'ShellRole_SeamAccent_Accent',
} as const;

export type BoxPalette = { body: Float4; seam: Float4 };

/** glTF baseColorFactor is linear; UI colors are sRGB hex. */
export function hexToLinear(hex: string): Float4 {
  const clean = hex.replace('#', '');
  const value = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  const channels = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff].map(c => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return [channels[0], channels[1], channels[2], 1];
}

export function paletteFromTheme(theme: { body: string; seam: string }): BoxPalette {
  return { body: hexToLinear(theme.body), seam: hexToLinear(theme.seam) };
}

/** Walks every primitive and re-tints by material name. Runs on the Filament thread. */
export function applyPalette(
  renderableManager: RenderableManager,
  asset: FilamentAsset,
  palette: BoxPalette,
): void {
  'worklet';
  const entities = asset.getRenderableEntities();
  for (let e = 0; e < entities.length; e++) {
    const entity = entities[e];
    const count = renderableManager.getPrimitiveCount(entity);
    for (let i = 0; i < count; i++) {
      const material = renderableManager.getMaterialInstanceAt(entity, i);
      const name = material.name;
      if (name === 'ShellRole_Body_Matte') {
        material.setFloat4Parameter('baseColorFactor', palette.body);
      } else if (name === 'ShellRole_SeamAccent_Accent') {
        material.setFloat4Parameter('baseColorFactor', palette.seam);
      }
    }
  }
}
