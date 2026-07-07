import type { EncodingConf } from './config';
import { usesCalibration } from './config';
import { DctCalc } from './dct';
import { Uint8ArrayBuilder } from './uint_array_builder';
import { DctCoefIterator, countTotalBits } from './blocks_iterator.ts';
import {
  applyLumaCorrection,
  CALIBRATION_LUMA_VALUES,
  fitLinearCorrection,
  readCalibrationLuma,
} from './calibration.ts';
import { DecodingStep, StepStatusCode } from './progress.ts';

export interface Decoder {
  decode: (mat: any, debug?: boolean, progress?: (step: number, state: number) => void) => any;
}

export class DecoderImpl implements Decoder {
  private lumaMat: any;
  private conf: EncodingConf;
  private cv: any;
  private res?: Uint8ArrayBuilder;
  private height: number = 0;
  private width: number = 0;

  // step-by-step matrices for debugging
  public dataMatrix: any;
  public ycrcb: any;
  public bgr32f: any;
  public transformed: any;

  constructor(cv: any, conf: EncodingConf) {
    this.conf = conf;
    this.cv = cv;
  }

  decode(bgr32f: any, debug: boolean = false, progress?: (step: number, state: number) => void) {
    progress?.(DecodingStep.CONVERT_TO_YCRCB, StepStatusCode.IN_PROGRESS);
    this.bgr32f = bgr32f;
    if (bgr32f.rows % 8 != 0 || bgr32f.cols % 8 != 0) {
      throw new Error(`image dimensions should be multiples of 8; got ${bgr32f.rows}x${bgr32f.cols}`);
    }
    this.height = bgr32f.rows;
    this.width = bgr32f.cols;
    const expectedSize = Math.ceil(countTotalBits(this.width, this.height, this.conf) / 8);
    this.res = new Uint8ArrayBuilder(expectedSize);

    this.ycrcb = new this.cv.Mat();
    this.cv.cvtColor(bgr32f, this.ycrcb, this.cv.COLOR_BGR2YCrCb);
    if (usesCalibration(this.conf)) {
      const measured = readCalibrationLuma(this.ycrcb);
      const { scale, offset } = fitLinearCorrection(CALIBRATION_LUMA_VALUES, measured);
      applyLumaCorrection(this.ycrcb, scale, offset);
    }
    progress?.(DecodingStep.CONVERT_TO_YCRCB, StepStatusCode.COMPLETED);

    progress?.(DecodingStep.EXTRACT_CHANNELS, StepStatusCode.IN_PROGRESS);
    const channels = new this.cv.MatVector();
    this.cv.split(this.ycrcb, channels);
    this.lumaMat = channels.get(0);
    channels.get(1).delete();
    channels.get(2).delete();
    channels.delete();
    progress?.(DecodingStep.EXTRACT_CHANNELS, StepStatusCode.COMPLETED);

    progress?.(DecodingStep.DENORMALIZE, StepStatusCode.IN_PROGRESS);
    this.applyTransforms();
    if (debug) this.transformed = this.lumaMat.clone();
    progress?.(DecodingStep.DENORMALIZE, StepStatusCode.COMPLETED);

    progress?.(DecodingStep.INVERSE_DCT, StepStatusCode.IN_PROGRESS);
    const dctCalc = new DctCalc(this.cv);
    dctCalc.init();
    this.inverseDct(dctCalc);
    dctCalc.cleanup();
    this.dataMatrix = this.lumaMat.clone();
    this.decodeDct();
    const uintArr = this.res.toUint8Array();
    progress?.(DecodingStep.INVERSE_DCT, StepStatusCode.COMPLETED);

    return uintArr;
  }

  private applyTransforms() {
    const transform = this.conf.dctToImageTransform;
    this.lumaMat.convertTo(this.lumaMat, -1, 1, -transform.addition);
    this.lumaMat.convertTo(this.lumaMat, -1, 1 / transform.multiplier, 0);
  }

  private inverseDct(dct: DctCalc) {
    if (this.conf.conf.length != 0) {
      const transformed = dct.dct8x8Mat(this.lumaMat);
      this.lumaMat.delete();
      this.lumaMat = transformed;
    }
  }

  private decodeDct() {
    const iter = new DctCoefIterator(this.width, this.height, this.conf);
    let next = iter.next();
    while (next) {
      const max = (1 << next.bitsCapacity) - 1;
      const dctCoef = this.lumaMat.floatPtr(next.y, next.x)[0];
      const value = Math.round(dctCoef * max);
      for (let i = next.bitsCapacity - 1; i >= 0; i--) {
        const bitValue = (value >> i) & 1;
        this.res?.addBit(bitValue);
      }
      next = iter.next();
    }
  }
}
