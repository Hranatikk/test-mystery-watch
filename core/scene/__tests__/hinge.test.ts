import { HINGE_PIVOT, hingeMatrix, LID_OPEN_RADIANS, lidAngle, transformPoint } from '../hinge';

const close = (a: readonly number[], b: readonly number[], digits = 3) =>
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));

describe('hinge', () => {
  it('is identity when closed', () => {
    close(hingeMatrix(0), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });

  it('keeps the pivot fixed at any angle', () => {
    for (const theta of [0.3, 1, LID_OPEN_RADIANS]) {
      close(transformPoint(hingeMatrix(theta), [0.2, HINGE_PIVOT[1], HINGE_PIVOT[2]]), [0.2, HINGE_PIVOT[1], HINGE_PIVOT[2]]);
    }
  });

  it('never moves points along the hinge axis', () => {
    const p = transformPoint(hingeMatrix(1.2), [0.42, 1.0, -0.2]);
    expect(p[0]).toBeCloseTo(0.42, 6);
  });

  it('matches the fully-open bounds from MODEL.md at 115°', () => {
    // Lowest front edge of the lid becomes the highest point when open (Y≈1.8654).
    const lowFront = transformPoint(hingeMatrix(LID_OPEN_RADIANS), [0, 0.25, -0.38]);
    expect(lowFront[1]).toBeCloseTo(1.8654, 2);
    // Top front edge swings furthest back (Z≈0.8543).
    const topFront = transformPoint(hingeMatrix(LID_OPEN_RADIANS), [0, 1.1166, -0.38]);
    expect(topFront[2]).toBeCloseTo(0.8543, 2);
  });

  it('clamps progress to 0..115°', () => {
    expect(lidAngle(-1)).toBe(0);
    expect(lidAngle(0.5)).toBeCloseTo(LID_OPEN_RADIANS / 2);
    expect(lidAngle(2)).toBeCloseTo(LID_OPEN_RADIANS);
  });
});
