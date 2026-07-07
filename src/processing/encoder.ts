import type { BitsIterator } from './bits_iter';
import type { EncodingConf } from './config';
import { DctCalc } from './dct';
import { DctCoefIterator } from './blocks_iterator.ts';
import { buildYCrCbFromLuma, writeCalibrationBlocks } from './calibration.ts';
import { EncodingStep, StepStatusCode } from './progress.ts';

export interface Encoder {
  encode: (debug?: boolean, progress?: (step: number, state: number) => void) => any;
}

export class EncoderImpl implements Encoder {
  private lumaMat: any;
  private bitsIter: BitsIterator;
  private conf: EncodingConf;
  private cv: any;
  private height: number;
  private width: number;

  // step-by-step matrices for debugging
  public dataMatrix: any;
  public ycrcb: any;
  public transformed: any;
  public bgr32f: any;

  constructor(cv: any, width: number, height: number, bitsIter: BitsIterator, conf: EncodingConf) {
    if (height % 8 !== 0 || width % 8 != 0) throw new Error('dimensions should be multiples of 8');

    this.height = height;
    this.width = width;
    this.lumaMat = cv.Mat.zeros(height, width, cv.CV_32FC1);
    this.bitsIter = bitsIter;
    this.conf = conf;
    this.cv = cv;
  }

  public encode(debug: boolean = false, progress?: (step: number, state: number) => void): any {
    progress?.(EncodingStep.POPULATE_DCT, StepStatusCode.IN_PROGRESS);
    this.populateDctMatrix();
    progress?.(EncodingStep.POPULATE_DCT, StepStatusCode.COMPLETED);

    progress?.(EncodingStep.DCT, StepStatusCode.IN_PROGRESS);
    const dctCalc = new DctCalc(this.cv);
    dctCalc.init();
    this.applyDct(dctCalc);
    dctCalc.cleanup();
    if (debug) this.ycrcb = buildYCrCbFromLuma(this.cv, this.lumaMat);
    progress?.(EncodingStep.DCT, StepStatusCode.COMPLETED);

    progress?.(EncodingStep.NORMALIZE, StepStatusCode.IN_PROGRESS);
    this.applyTransforms();
    writeCalibrationBlocks(this.lumaMat);
    const transformed = buildYCrCbFromLuma(this.cv, this.lumaMat);
    if (debug) this.transformed = transformed.clone();
    progress?.(EncodingStep.NORMALIZE, StepStatusCode.COMPLETED);

    progress?.(EncodingStep.CONVERT_TO_BGR, StepStatusCode.IN_PROGRESS);
    this.bgr32f = new this.cv.Mat();
    this.cv.cvtColor(transformed, this.bgr32f, this.cv.COLOR_YCrCb2BGR);
    transformed.delete();
    const min = new this.cv.Mat(this.bgr32f.rows, this.bgr32f.cols, this.bgr32f.type(), [1, 1, 1, 0]);
    this.cv.min(this.bgr32f, min, this.bgr32f);
    min.delete();
    const max = new this.cv.Mat(this.bgr32f.rows, this.bgr32f.cols, this.bgr32f.type(), [0, 0, 0, 0]);
    this.cv.max(this.bgr32f, max, this.bgr32f);
    max.delete();
    this.lumaMat.delete();
    progress?.(EncodingStep.CONVERT_TO_BGR, StepStatusCode.COMPLETED);
    console.log('encode complete');

    return this.bgr32f;
  }

  private populateDctMatrix() {
    const iter = new DctCoefIterator(this.width, this.height, this.conf);
    let next = iter.next();
    while (next) {
      const byte = this.bitsIter.nextN(next.bitsCapacity) ?? 0;
      const max = (1 << next.bitsCapacity) - 1;
      this.lumaMat.floatPtr(next.y, next.x)[0] = byte / max;
      next = iter.next();
    }
    if (this.bitsIter.next() !== null) {
      throw new Error('File is to large');
    }
  }

  private applyTransforms() {
    const transform = this.conf.dctToImageTransform;
    this.lumaMat.convertTo(this.lumaMat, -1, transform.multiplier, transform.addition);
  }

  private applyDct(dct: DctCalc) {
    if (this.conf.conf.length != 0) {
      const transformed = dct.idct8x8Mat(this.lumaMat);
      this.lumaMat.delete();
      this.lumaMat = transformed;
    }
  }
}
