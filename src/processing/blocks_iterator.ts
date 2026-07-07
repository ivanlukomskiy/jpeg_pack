import { isCalibrationBlock } from './calibration.ts';
import type { DctCoefConf, EncodingConf } from './config.ts';

export const BLOCK_SIZE = 8;

export const BlockType = {
  LUMA: 'luma',
} as const;

export type BlockType = (typeof BlockType)[keyof typeof BlockType];

export function getBlockGridSize(width: number, height: number) {
  return {
    blockCols: Math.ceil(width / BLOCK_SIZE),
    blockRows: Math.ceil(height / BLOCK_SIZE),
  };
}

export interface DctCoefPoint {
  x: number;
  y: number;
  confX: number;
  confY: number;
  conf: DctCoefConf;
  bitsCapacity: number;
}

export class DctCoefIterator {
  private blockIndex = -1;
  private confIdx = 0;
  private readonly confs: DctCoefConf[];
  private readonly blockCols: number;
  private readonly blockRows: number;

  constructor(width: number, height: number, conf: EncodingConf) {
    this.confs = conf.conf;
    const grid = getBlockGridSize(width, height);
    this.blockCols = grid.blockCols;
    this.blockRows = grid.blockRows;
  }

  public next(): DctCoefPoint | null {
    while (true) {
      if (this.confIdx >= this.confs.length) {
        this.confIdx = 0;
        do {
          this.blockIndex++;
          if (this.blockIndex >= this.blockCols * this.blockRows) {
            return null;
          }
        } while (isCalibrationBlock(this.blockIndex, this.blockCols));
        continue;
      }

      if (this.blockIndex < 0) {
        do {
          this.blockIndex++;
          if (this.blockIndex >= this.blockCols * this.blockRows) {
            return null;
          }
        } while (isCalibrationBlock(this.blockIndex, this.blockCols));
      }

      const conf = this.confs[this.confIdx++];
      const blockCol = this.blockIndex % this.blockCols;
      const blockRow = Math.floor(this.blockIndex / this.blockCols);
      const xBase = blockCol * BLOCK_SIZE;
      const yBase = blockRow * BLOCK_SIZE;
      return {
        x: xBase + conf.x,
        y: yBase + conf.y,
        conf,
        confX: conf.x,
        confY: conf.y,
        bitsCapacity: conf.bitsCapacity,
      };
    }
  }
}

export interface DctConfStats {
  offsetToName: Record<number, string>;
  nameToBitsInBlock: Record<string, number>;
  blockSizeBits: number;
}

function blockName(confX: number, confY: number) {
  return `${BlockType.LUMA}_${confX}_${confY}`;
}

function iterBlockCoefPoints(conf: EncodingConf): DctCoefPoint[] {
  return conf.conf.map(c => ({
    x: c.x,
    y: c.y,
    conf: c,
    confX: c.x,
    confY: c.y,
    bitsCapacity: c.bitsCapacity,
  }));
}

export function getBlockDataBits(conf: EncodingConf): number {
  return iterBlockCoefPoints(conf).reduce((sum, point) => sum + point.bitsCapacity, 0);
}

export function buildDctConfStats(conf: EncodingConf): DctConfStats {
  const offsetToName: Record<number, string> = {};
  const nameToBitsInBlock: Record<string, number> = {};
  let offset = 0;
  let blockSize = 0;
  for (const next of iterBlockCoefPoints(conf)) {
    const name = blockName(next.confX, next.confY);
    for (let i = 0; i < next.bitsCapacity; i++) {
      offsetToName[offset] = name;
      offset++;
      blockSize++;
    }
    if (!nameToBitsInBlock[name]) nameToBitsInBlock[name] = 0;
    nameToBitsInBlock[name] += next.bitsCapacity;
  }
  return { offsetToName, blockSizeBits: blockSize, nameToBitsInBlock };
}

export function countIteratorPoints(width: number, height: number, conf: EncodingConf): number {
  const iter = new DctCoefIterator(width, height, conf);
  let count = 0;
  let next = iter.next();
  while (next) {
    count++;
    next = iter.next();
  }
  return count;
}

export function countTotalBits(width: number, height: number, conf: EncodingConf): number {
  const iter = new DctCoefIterator(width, height, conf);
  let bits = 0;
  let next = iter.next();
  while (next) {
    bits += next.bitsCapacity;
    next = iter.next();
  }
  return bits;
}

export function countBlocksByName(width: number, height: number, conf: EncodingConf): Record<string, number> {
  const counts: Record<string, number> = {};
  const iter = new DctCoefIterator(width, height, conf);
  let next = iter.next();
  while (next) {
    const name = blockName(next.confX, next.confY);
    counts[name] = (counts[name] ?? 0) + 1;
    next = iter.next();
  }
  return counts;
}

export function normalizeErrorSources(
  errCountByName: Record<string, number>,
  stats: DctConfStats,
  width: number,
  height: number,
  iterations: number,
  conf: EncodingConf,
): Record<string, number> {
  const blockCounts = countBlocksByName(width, height, conf);
  console.log('errCountByName', errCountByName);
  const normalized: Record<string, number> = {};
  Object.keys(stats.nameToBitsInBlock).forEach(name => {
    const blocksCount = blockCounts[name] ?? 0;
    const totalBits = blocksCount * stats.nameToBitsInBlock[name];
    const errors = errCountByName[name] || 0;
    normalized[name] = totalBits > 0 ? errors / totalBits / iterations : 0;
  });
  console.log('normalized', normalized);
  return normalized;
}
