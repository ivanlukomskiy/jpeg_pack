import type {DctCoefConf, EncodingConf} from "./config.ts";

export enum BlockType {
    LUMA="luma",
    CR="chroma_red",
    CB="chroma_blue",
}

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
                offsetX, offsetY, conf, blockType, chIdx
            })
        })
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
        this.stages = buildStages(conf)
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
        return {
            x: xBase + stage.offsetX + stage.conf.x,
            y: yBase + stage.offsetY + stage.conf.y,
            conf: stage.conf,
            confX: stage.conf.x,
            confY: stage.conf.y,
            chIdx: stage.chIdx,
            bitsCapacity: stage.conf.bitsCapacity,
            blockType: stage.blockType,
        }
    }
}
