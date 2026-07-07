import type { EncodingConf } from './config';
import { DctCalc } from './dct';
import { Uint8ArrayBuilder } from './uint_array_builder';
import { DctCoefIterator, getChromaPlaneSize } from './blocks_iterator.ts';
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
  private image: any;
  private conf: EncodingConf;
  private cv: any;
  private res?: Uint8ArrayBuilder;
  private channels: any;
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
    let bitsPerBlock = 0;
    this.conf.chromaConf.forEach(c => {
      bitsPerBlock += c.bitsCapacity * 2;
    });
    this.conf.lumaConf.forEach(c => {
      bitsPerBlock += c.bitsCapacity;
    });
    const expectedSize = (((bitsPerBlock * bgr32f.rows) / 8) * bgr32f.cols) / 8 / 8;
    this.res = new Uint8ArrayBuilder(expectedSize);

    this.ycrcb = new this.cv.Mat();
    this.cv.cvtColor(bgr32f, this.ycrcb, this.cv.COLOR_BGR2YCrCb);
    const measured = readCalibrationLuma(this.ycrcb);
    const { scale, offset } = fitLinearCorrection(CALIBRATION_LUMA_VALUES, measured);
    applyLumaCorrection(this.ycrcb, scale, offset);
    this.image = this.ycrcb;
    progress?.(DecodingStep.CONVERT_TO_YCRCB, StepStatusCode.COMPLETED);

    progress?.(DecodingStep.EXTRACT_CHANNELS, StepStatusCode.IN_PROGRESS);
    this.splitToChannels();
    progress?.(DecodingStep.EXTRACT_CHANNELS, StepStatusCode.COMPLETED);

    progress?.(DecodingStep.DENORMALIZE, StepStatusCode.IN_PROGRESS);
    this.applyTransforms();
    if (debug) this.transformed = this.snapshot();
    progress?.(DecodingStep.DENORMALIZE, StepStatusCode.COMPLETED);

    progress?.(DecodingStep.INVERSE_DCT, StepStatusCode.IN_PROGRESS);
    const dctCalc = new DctCalc(this.cv);
    dctCalc.init();
    this.inverseDct(dctCalc);
    dctCalc.cleanup();
    this.dataMatrix = this.snapshot();
    this.decodeDct();
    const uintArr = this.res.toUint8Array();
    progress?.(DecodingStep.INVERSE_DCT, StepStatusCode.COMPLETED);

    return uintArr;
  }

  private upscale(mat: any) {
    const dst = new this.cv.Mat(this.height, this.width, this.cv.CV_32FC1, new this.cv.Scalar(0));
    // fixme slow
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        dst.floatPtr(y, x)[0] = mat.floatPtr(Math.floor(y / 2), Math.floor(x / 2))[0];
      }
    }
    return dst;
  }

  // fixme unite
  private snapshot() {
    const channels = new this.cv.MatVector();
    channels.push_back(this.channels.get(0));

    const upscaled1 = this.upscale(this.channels.get(1));
    channels.push_back(upscaled1);

    const upscaled2 = this.upscale(this.channels.get(2));
    channels.push_back(upscaled2);

    const dst = new this.cv.Mat();
    this.cv.merge(channels, dst);
    channels.delete();
    upscaled1.delete();
    upscaled2.delete();

    return dst;
  }

  private downsampleBy2(mat: any) {
    const dst = new this.cv.Mat(this.height / 2, this.width / 2, this.cv.CV_32FC1, new this.cv.Scalar(0));
    // fixme slow
    for (let y = 0; y < this.height / 2; y++) {
      for (let x = 0; x < this.width / 2; x++) {
        dst.floatPtr(y, x)[0] = mat.floatPtr(y * 2, x * 2)[0];
      }
    }
    return dst;
  }

  private padChromaMat(mat: any) {
    const chromaSize = getChromaPlaneSize(this.width, this.height);
    if (mat.rows === chromaSize.rows && mat.cols === chromaSize.cols) {
      return mat;
    }
    const dst = new this.cv.Mat(chromaSize.rows, chromaSize.cols, this.cv.CV_32FC1, new this.cv.Scalar(0));
    const roi = dst.roi(new this.cv.Rect(0, 0, mat.cols, mat.rows));
    mat.copyTo(roi);
    roi.delete();
    mat.delete();
    return dst;
  }

  private splitToChannels() {
    this.channels = new this.cv.MatVector();
    this.cv.split(this.image, this.channels);

    let tmp = this.channels.get(1);
    let downsampled = this.downsampleBy2(tmp);
    tmp.delete();
    this.channels.set(1, this.padChromaMat(downsampled));

    tmp = this.channels.get(2);
    downsampled = this.downsampleBy2(tmp);
    tmp.delete();
    this.channels.set(2, this.padChromaMat(downsampled));
  }

  private applyTransforms() {
    for (let i = 0; i < this.channels.size(); i++) {
      const ch = this.channels.get(i);
      const transform = i == 0 ? this.conf.lumaDctToImageTransform : this.conf.chromaDctToImageTransform;
      ch.convertTo(ch, -1, 1, -transform.addition); // ch = ch*30 + 10
      ch.convertTo(ch, -1, 1 / transform.multiplier, 0); // ch = ch*30 + 10
      this.channels.set(i, ch);
      ch.delete();
    }
  }

  private inverseDct(dct: DctCalc) {
    for (let chIdx = 0; chIdx < 3; chIdx++) {
      const conf = chIdx == 0 ? this.conf.lumaConf : this.conf.chromaConf;
      const ch = this.channels.get(chIdx);
      if (conf.length != 0) {
        // make no changes
        const transformed = dct.dct8x8Mat(ch);
        this.channels.set(chIdx, transformed);
      }
    }
  }

  private decodeDct() {
    const iter = new DctCoefIterator(this.width, this.height, this.conf);
    let next = iter.next();
    while (next) {
      const ch = this.channels.get(next.chIdx);
      const max = (1 << next.bitsCapacity) - 1;
      const dctCoef = ch.floatPtr(next.y, next.x)[0];
      const value = Math.round(dctCoef * max);
      for (let i = next.bitsCapacity - 1; i >= 0; i--) {
        const bitValue = (value >> i) & 1;
        this.res?.addBit(bitValue);
      }
      next = iter.next();
    }
  }
}
