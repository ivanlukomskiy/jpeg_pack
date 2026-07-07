import type { DctCoefConf, EncodingConf } from './config.ts';

export const BlockType = {
  LUMA: 'luma',
  CR: 'chroma_red',
  CB: 'chroma_blue',
} as const;

export type BlockType = (typeof BlockType)[keyof typeof BlockType];

interface EncodingStage {
  offsetX: number;
  offsetY: number;
  conf: DctCoefConf;
  chIdx: number;
  blockType: BlockType;
}

function buildStages(conf: EncodingConf) {
  const stages: EncodingStage[] = [];
  function addStage(confs: DctCoefConf[], offsetX: number, offsetY: number, blockType: BlockType, chIdx: number) {
    confs.forEach(conf => {
      stages.push({
        offsetX,
        offsetY,
        conf,
        blockType,
        chIdx,
      });
    });
  }
  addStage(conf.lumaConf, 0, 0, BlockType.LUMA, 0);
  addStage(conf.lumaConf, 8, 0, BlockType.LUMA, 0);
  addStage(conf.lumaConf, 0, 8, BlockType.LUMA, 0);
  addStage(conf.lumaConf, 8, 8, BlockType.LUMA, 0);
  addStage(conf.chromaConf, 0, 0, BlockType.CR, 1);
  addStage(conf.chromaConf, 0, 0, BlockType.CB, 2);
  return stages;
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
  private stageIdx: number = -1;
  private readonly width: number;
  private readonly height: number;
  private readonly stages: EncodingStage[];

  constructor(width: number, height: number, conf: EncodingConf) {
    this.width = width;
    this.height = height;
    this.stages = buildStages(conf);
  }

  public next(): DctCoefPoint | null {
    this.stageIdx++;
    if (this.stageIdx >= (this.width / 16) * (this.height / 16) * this.stages.length) {
      return null;
    }
    const stageLoops = Math.floor(this.stageIdx / this.stages.length);
    const xBase = (stageLoops % (this.width / 16)) * 16;
    const yBase = Math.floor(stageLoops / (this.width / 16)) * 16;
    const stage = this.stages[this.stageIdx % this.stages.length];
    const downsampleCoef = stage.blockType == BlockType.LUMA ? 1 : 2;
    return {
      x: xBase / downsampleCoef + stage.offsetX + stage.conf.x,
      y: yBase / downsampleCoef + stage.offsetY + stage.conf.y,
      conf: stage.conf,
      confX: stage.conf.x,
      confY: stage.conf.y,
      chIdx: stage.chIdx,
      bitsCapacity: stage.conf.bitsCapacity,
      blockType: stage.blockType,
    };
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

export function normalizeErrorSources(
  errCountByName: Record<string, number>,
  stats: DctConfStats,
  width: number,
  height: number,
  iterations: number,
): Record<string, number> {
  const blocksCount = (width / 16) * (height / 16);
  console.log('errCountByName', errCountByName);
  const normalized: Record<string, number> = {};
  Object.keys(stats.nameToBitsInBlock).forEach(name => {
    const totalBits = blocksCount * stats.nameToBitsInBlock[name];
    const errors = errCountByName[name] || 0;
    normalized[name] = totalBits > 0 ? errors / totalBits / iterations : 0;
  });
  console.log('normalized', normalized);
  return normalized;
}
