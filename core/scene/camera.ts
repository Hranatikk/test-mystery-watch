/**
 * Camera framing for the box. Pure math, runs on the Filament thread.
 *
 * Filament's lens projection uses a 24 mm sensor height, so
 * vertical fov = 2·atan(12 / focalLength).
 */
export const FOCAL_LENGTH_MM = 40;
const HALF_SENSOR_MM = 12;

/** Closed bounds: Y 0…1.1166, X ±0.56, Z ±0.38 (MODEL.md). */
export const BOX_CENTER_Y = 0.558;
const CLOSED = { halfHeight: 0.56, halfWidth: 0.68, centerY: 0 };
/** Fully open bounds: Y 0…1.8654, Z −0.63…0.85. Expressed relative to BOX_CENTER_Y. */
const OPEN = { halfHeight: 0.93, halfWidth: 0.72, centerY: 0.37 };

export type CameraPose = {
  eye: [number, number, number];
  target: [number, number, number];
};

/**
 * @param aspect view width / height
 * @param open 0 (closed bounds) … 1 (fully open bounds)
 * @param zoom user zoom, 1 = fitted
 * @param elevation camera elevation in radians
 * @param margin breathing room around the bounds
 */
export function frameBox(
  aspect: number,
  open: number,
  zoom: number,
  elevation: number,
  margin: number,
): CameraPose {
  'worklet';
  const t = Math.min(1, Math.max(0, open));
  const halfH = CLOSED.halfHeight + (OPEN.halfHeight - CLOSED.halfHeight) * t;
  const halfW = CLOSED.halfWidth + (OPEN.halfWidth - CLOSED.halfWidth) * t;
  const centerY = CLOSED.centerY + (OPEN.centerY - CLOSED.centerY) * t;

  const tanV = HALF_SENSOR_MM / FOCAL_LENGTH_MM;
  const tanH = tanV * Math.max(0.1, aspect);
  const distance = (Math.max(halfH / tanV, halfW / tanH) * margin) / Math.max(0.1, zoom);

  const y = centerY + Math.sin(elevation) * distance;
  const z = Math.cos(elevation) * distance;
  return { eye: [0, y, z], target: [0, centerY, 0] };
}
