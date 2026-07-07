import { expect, test } from 'vitest';
import {
  applyLumaCorrection,
  CALIBRATION_LUMA_VALUES,
  fitLinearCorrection,
} from './calibration';

test('fitLinearCorrection recovers identity for exact values', () => {
  const { scale, offset } = fitLinearCorrection(CALIBRATION_LUMA_VALUES, CALIBRATION_LUMA_VALUES);
  expect(scale).toBeCloseTo(1, 5);
  expect(offset).toBeCloseTo(0, 5);
});

test('fitLinearCorrection fits affine brightness shift', () => {
  const scale = 0.9;
  const offset = 0.05;
  const measured = CALIBRATION_LUMA_VALUES.map(v => scale * v + offset);
  const fit = fitLinearCorrection(CALIBRATION_LUMA_VALUES, measured);
  expect(fit.scale).toBeCloseTo(scale, 5);
  expect(fit.offset).toBeCloseTo(offset, 5);
});

test('applyLumaCorrection inverts affine shift on Y channel', () => {
  const scale = 0.85;
  const offset = 0.08;
  const rows = 16;
  const cols = 16;
  const channels = 3;
  const data = new Float32Array(rows * cols * channels);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = (y * cols + x) * channels;
      const shifted = scale * 0.4 + offset;
      data[idx] = shifted;
      data[idx + 1] = 0.5;
      data[idx + 2] = 0.5;
    }
  }
  const mat = {
    rows,
    cols,
    floatPtr(y: number, x: number) {
      const idx = (y * cols + x) * channels;
      return data.subarray(idx, idx + channels);
    },
  };
  applyLumaCorrection(mat, scale, offset);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = (y * cols + x) * channels;
      expect(data[idx]).toBeCloseTo(0.4, 5);
    }
  }
});

test('fitLinearCorrection guards near-zero scale', () => {
  const measured = [1, 1, 1, 1];
  const { scale } = fitLinearCorrection(CALIBRATION_LUMA_VALUES, measured);
  expect(scale).toBe(1);
});
