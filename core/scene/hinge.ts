import type { Mat4, TransformManager } from 'react-native-filament';

/** Values from assets/models/MODEL.md. */
export const HINGE_PIVOT = [0, 0.914876, 0.359181] as const;
export const HINGE_AXIS = [1, 0, 0] as const;
export const LID_OPEN_DEGREES = 115;
export const LID_OPEN_RADIANS = (LID_OPEN_DEGREES * Math.PI) / 180;

/** Nodes that rotate together around the hinge. */
export const HINGED_NODES = ['Shell_Lid', 'Shell_Wordmark'] as const;

/** Maps 0..1 progress to the lid angle in radians (closed → +115°). */
export function lidAngle(progress: number): number {
  'worklet';
  return Math.min(1, Math.max(0, progress)) * LID_OPEN_RADIANS;
}

/**
 * Pure reference implementation of T(pivot) · Rx(θ) · T(−pivot) as a
 * column-major 4×4 matrix (Filament's layout). Used by unit tests and as
 * documentation for {@link hingeTransform}.
 */
export function hingeMatrix(theta: number): number[] {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const [, py, pz] = HINGE_PIVOT;
  // Rx(θ) = [1 0 0; 0 c −s; 0 s c]; translation = p − R·p
  const ty = py - (c * py - s * pz);
  const tz = pz - (s * py + c * pz);
  // prettier-ignore
  return [
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, ty, tz, 1,
  ];
}

/** Applies a column-major matrix to a point. */
export function transformPoint(m: readonly number[], p: readonly [number, number, number]) {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ] as const;
}

/**
 * Same matrix built with Filament's Mat4 helpers. Each helper pre-multiplies
 * (`M' = X · M`), so the chain reads right-to-left:
 * identity → T(−p) → Rx(θ) → T(p)  ⇒  T(p) · Rx(θ) · T(−p).
 */
export function hingeTransform(transformManager: TransformManager, theta: number): Mat4 {
  'worklet';
  return transformManager
    .createIdentityMatrix()
    .translate([-HINGE_PIVOT[0], -HINGE_PIVOT[1], -HINGE_PIVOT[2]])
    .rotate(theta, [HINGE_AXIS[0], HINGE_AXIS[1], HINGE_AXIS[2]])
    .translate([HINGE_PIVOT[0], HINGE_PIVOT[1], HINGE_PIVOT[2]]);
}
