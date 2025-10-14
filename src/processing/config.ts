export interface DctCoefConf {
    x: number;
    y: number;
    bitsCapacity: number;
}

export interface DctToImageTransform {
    multiplier: number;
    addition: number;
}

export interface EncodingConf {
    lumaConf: DctCoefConf[];
    chromaConf: DctCoefConf[];
    lumaDctToImageTransform: DctToImageTransform;
    chromaDctToImageTransform: DctToImageTransform;
}

export const DctConfs: DctCoefConf[] = [
    {x: 0, y: 0, bitsCapacity: 2},
    {x: 1, y: 0, bitsCapacity: 3},
    {x: 0, y: 1, bitsCapacity: 3},
    {x: 1, y: 1, bitsCapacity: 3},
    {x: 2, y: 0, bitsCapacity: 4},
    {x: 0, y: 2, bitsCapacity: 4},
    {x: 2, y: 2, bitsCapacity: 3},
    {x: 3, y: 0, bitsCapacity: 1},
    {x: 0, y: 3, bitsCapacity: 1},
] // 24

// 3 * 4 + 2 -> 14 bytes?

export const DctConfsChroma: DctCoefConf[] = [
    {x: 0, y: 0, bitsCapacity: 1},
    {x: 1, y: 0, bitsCapacity: 1},
    {x: 0, y: 1, bitsCapacity: 1},
    {x: 1, y: 1, bitsCapacity: 1},
    {x: 2, y: 0, bitsCapacity: 1},
    {x: 0, y: 2, bitsCapacity: 1},
    {x: 2, y: 2, bitsCapacity: 1},
    {x: 3, y: 3, bitsCapacity: 1},

    // {x: 0, y: 0, bitsCapacity: 2},
    // {x: 1, y: 0, bitsCapacity: 1},
    // {x: 0, y: 1, bitsCapacity: 1},
    // {x: 2, y: 0, bitsCapacity: 1},
    // {x: 0, y: 2, bitsCapacity: 1},
] // 4 * 2

export const DefaultEncodingConf: EncodingConf = {
    lumaConf: DctConfs,
    // chromaConf: DctConfs,
    chromaConf: DctConfsChroma,
    lumaDctToImageTransform: {
        multiplier: .3,
        addition: .3,
    },
    chromaDctToImageTransform: {
        multiplier: .3,
        // multiplier: .0,
        addition: .5,
    }
}

// 16 + 4 * 2 = 24 bits / block; 96 for 4 blocks
