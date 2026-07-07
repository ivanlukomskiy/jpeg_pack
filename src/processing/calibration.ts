export const CALIBRATION_BLOCK_COUNT = 4;
export const CALIBRATION_LUMA_VALUES = [0.25, 0.4, 0.55, 0.7];
export const CALIBRATION_BLOCK_OFFSETS = [
  { x: 0, y: 0 },
  { x: 8, y: 0 },
  { x: 0, y: 8 },
  { x: 8, y: 8 },
];
export const CALIBRATION_MCU_INDEX = 0;
export const CALIBRATION_NEUTRAL_CHROMA = 0.5;
const BLOCK_SIZE = 8;
const MIN_SCALE = 1e-4;

export function isCalibrationMcu(mcuIndex: number): boolean {
  return mcuIndex === CALIBRATION_MCU_INDEX;
}

function fillBlock(mat: any, x0: number, y0: number, value: number) {
  for (let y = y0; y < y0 + BLOCK_SIZE; y++) {
    for (let x = x0; x < x0 + BLOCK_SIZE; x++) {
      mat.floatPtr(y, x)[0] = value;
    }
  }
}

export function writeCalibrationBlocks(lumaMat: any, chromaCrMat: any, chromaCbMat: any) {
  for (let i = 0; i < CALIBRATION_BLOCK_COUNT; i++) {
    const { x, y } = CALIBRATION_BLOCK_OFFSETS[i];
    fillBlock(lumaMat, x, y, CALIBRATION_LUMA_VALUES[i]);
  }
  fillBlock(chromaCrMat, 0, 0, CALIBRATION_NEUTRAL_CHROMA);
  fillBlock(chromaCbMat, 0, 0, CALIBRATION_NEUTRAL_CHROMA);
}

function averageBlockY(ycrcbMat: any, x0: number, y0: number): number {
  let sum = 0;
  for (let y = y0; y < y0 + BLOCK_SIZE; y++) {
    for (let x = x0; x < x0 + BLOCK_SIZE; x++) {
      sum += ycrcbMat.floatPtr(y, x)[0];
    }
  }
  return sum / (BLOCK_SIZE * BLOCK_SIZE);
}

export function readCalibrationLuma(ycrcbMat: any): number[] {
  return CALIBRATION_BLOCK_OFFSETS.map(({ x, y }) => averageBlockY(ycrcbMat, x, y));
}

export interface LinearCorrection {
  scale: number;
  offset: number;
}

export function fitLinearCorrection(expected: number[], measured: number[]): LinearCorrection {
  const n = expected.length;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (let i = 0; i < n; i++) {
    sumX += expected[i];
    sumY += measured[i];
    sumXX += expected[i] * expected[i];
    sumXY += expected[i] * measured[i];
  }
  const denom = n * sumXX - sumX * sumX;
  let scale = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 1;
  if (Math.abs(scale) < MIN_SCALE) {
    scale = 1;
  }
  const offset = (sumY - scale * sumX) / n;
  return { scale, offset };
}

export function applyLumaCorrection(ycrcbMat: any, scale: number, offset: number) {
  const safeScale = Math.abs(scale) < MIN_SCALE ? 1 : scale;
  for (let y = 0; y < ycrcbMat.rows; y++) {
    for (let x = 0; x < ycrcbMat.cols; x++) {
      const ptr = ycrcbMat.floatPtr(y, x);
      const corrected = (ptr[0] - offset) / safeScale;
      ptr[0] = Math.min(1, Math.max(0, corrected));
    }
  }
}
