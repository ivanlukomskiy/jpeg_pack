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
  conf: DctCoefConf[];
  dctToImageTransform: DctToImageTransform;
  useCalibration?: boolean;
}

export function usesCalibration(conf: EncodingConf): boolean {
  return conf.useCalibration !== false;
}

export const DctConfs: DctCoefConf[] = [
  { x: 0, y: 0, bitsCapacity: 3 },
  { x: 1, y: 1, bitsCapacity: 3 },
  { x: 2, y: 2, bitsCapacity: 1 },
  { x: 3, y: 3, bitsCapacity: 2 },
  { x: 4, y: 4, bitsCapacity: 2 },
  { x: 5, y: 5, bitsCapacity: 2 },
  { x: 6, y: 6, bitsCapacity: 2 },

  { x: 1, y: 0, bitsCapacity: 3 },
  { x: 0, y: 1, bitsCapacity: 3 },

  { x: 2, y: 0, bitsCapacity: 3 },
  { x: 0, y: 2, bitsCapacity: 3 },

  { x: 3, y: 0, bitsCapacity: 3 },
  { x: 0, y: 3, bitsCapacity: 3 },

  { x: 4, y: 0, bitsCapacity: 3 },
  { x: 0, y: 4, bitsCapacity: 3 },

  { x: 5, y: 0, bitsCapacity: 3 },
  { x: 0, y: 5, bitsCapacity: 3 },

  { x: 6, y: 0, bitsCapacity: 3 },
  { x: 0, y: 6, bitsCapacity: 3 },

  { x: 1, y: 4, bitsCapacity: 3 },
  { x: 4, y: 1, bitsCapacity: 3 },

  { x: 2, y: 1, bitsCapacity: 2 },
  { x: 1, y: 2, bitsCapacity: 2 },

  { x: 1, y: 3, bitsCapacity: 3 },
  { x: 3, y: 1, bitsCapacity: 2 },
];

export const DefaultEncodingConf: EncodingConf = {
  conf: DctConfs,
  dctToImageTransform: {
    multiplier: 0.21,
    addition: 0.27,
  },
  useCalibration: true,
};

export const BenchmarkEncodingConf: EncodingConf = {
  ...DefaultEncodingConf,
  useCalibration: false,
};
