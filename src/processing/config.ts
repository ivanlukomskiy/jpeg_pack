export interface DctCoefConf {
    x: number;
    y: number;
    bitsCapacity: number;
}

export const DctConfs: DctCoefConf[] = [
    {x: 0, y: 0, bitsCapacity: 4},
    {x: 1, y: 0, bitsCapacity: 3},
    {x: 0, y: 1, bitsCapacity: 3},
    {x: 1, y: 1, bitsCapacity: 2},
    {x: 2, y: 0, bitsCapacity: 2},
    {x: 0, y: 2, bitsCapacity: 2},
]
export const DctConfsChroma: DctCoefConf[] = [
    {x: 0, y: 0, bitsCapacity: 2},
    {x: 1, y: 0, bitsCapacity: 1},
    {x: 0, y: 1, bitsCapacity: 1},
]
