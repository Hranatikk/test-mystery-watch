import type { ImageSourcePropType } from 'react-native';
import type { Watch, WatchImageKey } from './types';

/** Full size (1019 × 1544): heroes, the reveal and the share card. */
const IMAGES: Record<WatchImageKey, ImageSourcePropType> = {
  casio: require('@assets/images/watches/casio.png'),
  gmt: require('@assets/images/watches/gmt.png'),
  perpetual: require('@assets/images/watches/perpetual.png'),
  'sky-dweller': require('@assets/images/watches/sky-dweller.png'),
};

/**
 * ~300 × 456 (enough for ≤150 pt at 3×): tiles, lists and thumbnails. A full
 * PNG decodes to ~6 MB of RGBA; a grid of them costs memory and decode time on
 * the UI thread for no visible gain. Regenerate with `sips -Z 456`.
 */
const THUMBS: Record<WatchImageKey, ImageSourcePropType> = {
  casio: require('@assets/images/watches/thumbs/casio.png'),
  gmt: require('@assets/images/watches/thumbs/gmt.png'),
  perpetual: require('@assets/images/watches/thumbs/perpetual.png'),
  'sky-dweller': require('@assets/images/watches/thumbs/sky-dweller.png'),
};

export function watchImage(watch: Pick<Watch, 'imageKey'>): ImageSourcePropType {
  return IMAGES[watch.imageKey];
}

export function watchThumb(watch: Pick<Watch, 'imageKey'>): ImageSourcePropType {
  return THUMBS[watch.imageKey];
}

/** Intrinsic aspect ratio of the supplied watch PNGs (1019 × 1544). */
export const WATCH_IMAGE_ASPECT = 1019 / 1544;
