import type { BitsIterator } from "./bits_iter";
import type { DctCoefConf, EncodingConf } from "./config";
import { DctCalc } from "./dct";
import {DctCoefIterator} from "./blocks_iterator.ts";

export interface Encoder {
    encode: () => any;
}

export class EncoderImpl implements Encoder {
    private channels: any;
    private bitsIter: BitsIterator;
    private conf: EncodingConf;
    private cv: any;
    private height: number;
    private width: number;

    // step-by-step matrices for debugging
    private dataMatrix: any;
    public ycrcb: any;
    public transformed: any;
    public bgr32f: any;
    private prime: any;

    constructor(cv: any, width: number, height: number, bitsIter: BitsIterator, conf: EncodingConf) {
        if (height % 16 !== 0 || width % 16 != 0) throw new Error("dimensions should be multiples of 16");

        this.height = height;
        this.width = width;
        console.log("cv", cv)

        this.channels = new cv.MatVector();
        for (let i = 0; i < 3; i++) {
            const ds = i === 0 ? 1 : 2;
            const rows = Math.max(1, (height / ds) | 0); // integer, >= 1
            const cols = Math.max(1, (width  / ds) | 0); // integer, >= 1

            console.log('creating mat')
            // no "new" here; use CV_32FC1 explicitly
            const mat = cv.Mat.zeros(rows, cols, cv.CV_32FC1);
            console.log('pushing')
            this.channels.push_back(mat);
        }

        this.bitsIter = bitsIter;
        this.conf = conf;
        this.cv = cv;
    }

    private upscale(mat) {
        const dst = new this.cv.Mat(this.height, this.width, this.cv.CV_32FC1, new this.cv.Scalar(0));
        // fixme slow
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                dst.floatPtr(y, x)[0] = mat.floatPtr(
                    Math.floor(y / 2),
                    Math.floor(x / 2),
                )[0];
            }
        }
        return dst;
    }

    private snapshot() {
        const channels = new this.cv.MatVector();
        channels.push_back(this.channels.get(0))

        const upscaled1 = this.upscale(this.channels.get(1));
        channels.push_back(upscaled1)

        const upscaled2 = this.upscale(this.channels.get(2));
        channels.push_back(upscaled2)

        const dst = new this.cv.Mat();
        this.cv.merge(channels, dst);
        channels.delete();
        upscaled1.delete();
        upscaled2.delete();

        return dst;
    }

    public encode() {
        this.populateDctMatrix();
        this.dataMatrix = this.snapshot();
        console.log('data matrix shapshot ok')

        const dctCalc = new DctCalc(this.cv);
        console.log('dct constructor ok')
        dctCalc.init()
        console.log('applying dct')
        this.applyDct(dctCalc);
        console.log('dct apply ok')
        dctCalc.cleanup();
        console.log('dct cleanup ok')
        this.ycrcb = this.snapshot();
        console.log('ycrcb snapshot ok')


        this.applyTransforms();
        console.log('transforms ok')

        this.transformed = this.snapshot();
        console.log('transforms snapshot ok')

        this.bgr32f = new this.cv.Mat();
        console.log('1')
        this.cv.cvtColor(this.transformed, this.bgr32f, this.cv.COLOR_YCrCb2BGR)
        console.log('2')
        const min = new this.cv.Mat(this.bgr32f.rows, this.bgr32f.cols, this.bgr32f.type(), [1,1,1,0]);
        this.cv.min(this.bgr32f, min, this.bgr32f);
        min.delete();
        console.log('3')
        const max = new this.cv.Mat(this.bgr32f.rows, this.bgr32f.cols, this.bgr32f.type(), [0,0,0,0]);
        this.cv.max(this.bgr32f, max, this.bgr32f);
        max.delete();

        console.log('encode complete')

        // this.transformed.delete();
        // this.bgr32f.delete();
        this.channels.get(0).delete();
        this.channels.get(1).delete();
        this.channels.get(2).delete();
        this.channels.delete();

        return this.bgr32f;
    }

    private populateDctMatrix() {
        const iter = new DctCoefIterator(this.width, this.height, this.conf)
        let next = iter.next()
        while (next) {
            const ch = this.channels.get(next.chIdx);
            const byte = this.bitsIter.nextN(next.bitsCapacity) ?? 0;
            const max = (1 << next.bitsCapacity) - 1;
            const val = byte / max;
            ch.floatPtr(next.y, next.x)[0] = val;
            console.log('stored (', next.x, next.y, next.chIdx, ') orig', byte, 'frac', val)
            next = iter.next()
        }
        console.log('populate complete')
    }

    private applyTransforms() {
        for (let i = 0; i < this.channels.size(); i++) {
            const ch = this.channels.get(i);
            const transform = i == 0 ? this.conf.lumaDctToImageTransform : this.conf.chromaDctToImageTransform;
            ch.convertTo(ch, -1, transform.multiplier, transform.addition);
            this.channels.set(i, ch);
        }
    }

    private applyDct(dct: DctCalc) {
        // const newChannels = new this.cv.MatVector();
        for (let chIdx = 0; chIdx < 3; chIdx++) {
            const conf = chIdx == 0 ? this.conf.lumaConf : this.conf.chromaConf;
            const ch = this.channels.get(chIdx);
            if (conf.length != 0) {
                const transformed = dct.idct8x8Mat(ch);
                this.channels.get(chIdx).delete();
                this.channels.set(chIdx, transformed);
            }
        }
    }
}
