import { isCalibrationMcu } from './calibration.ts';
import type { DctCoefConf, EncodingConf } from './config.ts';

export const BlockType = {
  LUMA: 'luma',
  CR: 'chroma_red',
  CB: 'chroma_blue',
} as const;

export type BlockType = (typeof BlockType)[keyof typeof BlockType];

interface BlockGroup {
  offsetX: number;
  offsetY: number;
  blockType: BlockType;
  chIdx: number;
  confs: DctCoefConf[];
}

function buildBlockGroups(conf: EncodingConf): BlockGroup[] {
  return [
    { offsetX: 0, offsetY: 0, blockType: BlockType.LUMA, chIdx: 0, confs: conf.lumaConf },
    { offsetX: 8, offsetY: 0, blockType: BlockType.LUMA, chIdx: 0, confs: conf.lumaConf },
    { offsetX: 0, offsetY: 8, blockType: BlockType.LUMA, chIdx: 0, confs: conf.lumaConf },
    { offsetX: 8, offsetY: 8, blockType: BlockType.LUMA, chIdx: 0, confs: conf.lumaConf },
    { offsetX: 0, offsetY: 0, blockType: BlockType.CR, chIdx: 1, confs: conf.chromaConf },
    { offsetX: 0, offsetY: 0, blockType: BlockType.CB, chIdx: 2, confs: conf.chromaConf },
  ];
}

function groupFits(groupIndex: number, xBase: number, yBase: number, width: number, height: number): boolean {
  const group = groupIndex;
  if (group === 0) return xBase + 8 <= width && yBase + 8 <= height;
  if (group === 1) return xBase + 16 <= width && yBase + 8 <= height;
  if (group === 2) return xBase + 8 <= width && yBase + 16 <= height;
  if (group === 3 || group === 4 || group === 5) return xBase + 16 <= width && yBase + 16 <= height;
  return false;
}

export function getMcuGridSize(width: number, height: number) {
  return {
    mcuCols: Math.ceil(width / 16),
    mcuRows: Math.ceil(height / 16),
  };
}

export function getActiveGroupIndices(xBase: number, yBase: number, width: number, height: number): number[] {
  const indices: number[] = [];
  for (let i = 0; i < 6; i++) {
    if (groupFits(i, xBase, yBase, width, height)) {
      indices.push(i);
    }
  }
  return indices;
}

export function getChromaPlaneSize(width: number, height: number) {
  return {
    cols: Math.ceil(width / 16) * 8,
    rows: Math.ceil(height / 16) * 8,
  };
}

export interface DctCoefPoint {
  x: number;
  y: number;
  chIdx: number;
  confX: number;
  confY: number;
  conf: DctCoefConf;
  bitsCapacity: number;
  blockType: BlockType;
}

export class DctCoefIterator {
  private mcuIndex = -1;
  private groupIdx = 0;
  private confIdx = 0;
  private activeGroupIndices: number[] = [];
  private currentGroupConfs: DctCoefConf[] = [];
  private readonly width: number;
  private readonly height: number;
  private readonly blockGroups: BlockGroup[];
  private readonly mcuCols: number;
  private readonly mcuRows: number;

  constructor(width: number, height: number, conf: EncodingConf) {
    this.width = width;
    this.height = height;
    this.blockGroups = buildBlockGroups(conf);
    const grid = getMcuGridSize(width, height);
    this.mcuCols = grid.mcuCols;
    this.mcuRows = grid.mcuRows;
  }

  public next(): DctCoefPoint | null {
    while (true) {
      if (this.confIdx < this.currentGroupConfs.length) {
        const group = this.blockGroups[this.activeGroupIndices[this.groupIdx]];
        const conf = this.currentGroupConfs[this.confIdx++];
        const xBase = (this.mcuIndex % this.mcuCols) * 16;
        const yBase = Math.floor(this.mcuIndex / this.mcuCols) * 16;
        const downsampleCoef = group.blockType == BlockType.LUMA ? 1 : 2;
        return {
          x: xBase / downsampleCoef + group.offsetX + conf.x,
          y: yBase / downsampleCoef + group.offsetY + conf.y,
          conf,
          confX: conf.x,
          confY: conf.y,
          chIdx: group.chIdx,
          bitsCapacity: conf.bitsCapacity,
          blockType: group.blockType,
        };
      }

      this.groupIdx++;
      this.confIdx = 0;

      while (this.groupIdx >= this.activeGroupIndices.length) {
        do {
          this.mcuIndex++;
          this.groupIdx = 0;

          if (this.mcuIndex >= this.mcuCols * this.mcuRows) {
            return null;
          }
        } while (isCalibrationMcu(this.mcuIndex));

        const xBase = (this.mcuIndex % this.mcuCols) * 16;
        const yBase = Math.floor(this.mcuIndex / this.mcuCols) * 16;
        this.activeGroupIndices = getActiveGroupIndices(xBase, yBase, this.width, this.height);
      }

      const group = this.blockGroups[this.activeGroupIndices[this.groupIdx]];
      this.currentGroupConfs = group.confs;
    }
  }
}

export interface DctConfStats {
  offsetToName: Record<number, string>;
  nameToBitsInBlock: Record<string, number>;
  blockSizeBits: number;
}

function blockName(type: BlockType, confX: number, confY: number) {
  return `${type}_${confX}_${confY}`;
}

export function buildDctConfStats(conf: EncodingConf): DctConfStats {
  const iter = new DctCoefIterator(16, 16, conf);
  const offsetToName: Record<number, string> = {};
  const nameToBitsInBlock: Record<string, number> = {};
  let offset = 0;
  let blockSize = 0;
  let next = iter.next();
  while (next) {
    const name = blockName(next.blockType, next.confX, next.confY);
    for (let i = 0; i < next.bitsCapacity; i++) {
      offsetToName[offset] = name;
      offset++;
      blockSize++;
    }
    if (!nameToBitsInBlock[name]) nameToBitsInBlock[name] = 0;
    nameToBitsInBlock[name] += next.bitsCapacity;
    next = iter.next();
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
    const name = blockName(next.blockType, next.confX, next.confY);
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
