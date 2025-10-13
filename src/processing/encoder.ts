import type { BitsIterator } from "./bits_iter";
import type { DctCoefConf, EncodingConf } from "./config";
import { DctCalc } from "./dct";

export interface Encoder {
    encode: () => any;
}

export class EncoderImpl implements Encoder {
    private channels: any;
    private bitsIter: BitsIterator;
    private conf: EncodingConf;
    private cv: any;
    private height: number;

    // step-by-step matrices for debugging
    public dataMatrix: any;
    public ycrcb: any;
    public transformed: any;
    public bgr32f: any;
    public prime: any;

    constructor(cv: any, width: number, height: number, bitsIter: BitsIterator, conf: EncodingConf) {
        this.height = height;
        this.channels = new cv.MatVector();
        for (let i = 0; i < 3; i++) {
            const val = 0;
            // const val = i == 0 ? 0 : .5;
            const mat = new cv.Mat(height, width, cv.CV_32FC1, new cv.Scalar(val));
            mat.setTo(new cv.Scalar(val));
            this.channels.push_back(mat);
        }
        const kek = new cv.Mat();
        cv.merge(this.channels, kek);
        console.log('test', kek.floatPtr(0,0)[1])

        // this.image = new cv.Mat(width, height, cv.CV_32FC3)
        // this.image.setTo(new cv.Scalar(0, .5, .5))
        this.bitsIter = bitsIter
        this.conf = conf;
        this.cv = cv
    }

    public encode() {
        this.prime = new this.cv.Mat();
        this.cv.merge(this.channels, this.prime);
        console.log('test2', this.prime.floatPtr(0,0)[1])

        this.populateDctMatrix();
        this.dataMatrix = new this.cv.Mat();
        this.cv.merge(this.channels, this.dataMatrix);

        // this.dataMatrixWithTransforms = new this.cv.Mat();
        // this.cv.merge(this.channels, this.dataMatrixWithTransforms);

        const dctCalc = new DctCalc(this.cv);
        dctCalc.init()
        this.applyDct(dctCalc);
        // while (this.ch < 3) {
        //     this.encodeNextBlock(dctCalc);
        // }
        dctCalc.cleanup();
        this.ycrcb = new this.cv.Mat();
        this.cv.merge(this.channels, this.ycrcb);

        this.applyTransforms();

        this.transformed = new this.cv.Mat();
        this.cv.merge(this.channels, this.transformed);

        this.bgr32f = new this.cv.Mat();
        this.cv.cvtColor(this.transformed, this.bgr32f, this.cv.COLOR_YCrCb2BGR)
        this.cv.min(this.bgr32f, new this.cv.Mat(this.bgr32f.rows, this.bgr32f.cols, this.bgr32f.type(), [1,1,1,0]), this.bgr32f);
        this.cv.max(this.bgr32f, new this.cv.Mat(this.bgr32f.rows, this.bgr32f.cols, this.bgr32f.type(), [0,0,0,0]), this.bgr32f);

        return this.bgr32f;
        // const rgb8 = new this.cv.Mat();
        // this.rgb32.convertTo(rgb8, this.cv.CV_8U, 255);
        //
        // return rgb8;
    }

    private populateDctMatrix() {
        let x=0, y=0, chIdx=0;
        while (y < this.height) {
            const ch = this.channels.get(chIdx);
            const conf = chIdx == 0 ? this.conf.lumaConf : this.conf.chromaConf;
            // const transform = chIdx == 0 ? this.conf.lumaDctToImageTransform : this.conf.chromaDctToImageTransform;
            conf.forEach((c: DctCoefConf) => {
                const byte = this.bitsIter.nextN(c.bitsCapacity) ?? 0;
                const max = (1 << c.bitsCapacity) - 1;
                const val = byte / max;
                // const withTransform = val * transform.multiplier + transform.addition;
                // ch.floatPtr(c.y + y, c.x + x)[0] = withTransform;
                ch.floatPtr(c.y + y, c.x + x)[0] = val;
                console.log('stored ', c.x + x, c.y + y, chIdx, 'orig', byte, 'frac', val)
            })
            // fixme i can do better
            chIdx++;
            if (chIdx >= 3) {
                x += 8;
                chIdx = 0;
                if (x >= ch.cols) {
                    x = 0;
                    y += 8;
                }
            }
        }
    }

    private applyTransforms() {
        for (let i = 0; i < this.channels.size(); i++) {
            const ch = this.channels.get(i);
            const transform = i == 0 ? this.conf.lumaDctToImageTransform : this.conf.chromaDctToImageTransform;
            ch.convertTo(ch, -1, transform.multiplier, transform.addition);
            this.channels.set(i, ch);
            ch.delete();
        }
    }

    private applyDct(dct: DctCalc) {
        const newChannels = new this.cv.MatVector();
        for (let chIdx = 0; chIdx < 3; chIdx++) {
            const conf = chIdx == 0 ? this.conf.lumaConf : this.conf.chromaConf;
            const ch = this.channels.get(chIdx);
            if (conf.length == 0) { // make no changes
                newChannels.push_back(ch);
            } else {
                const transformed = dct.idct8x8Mat(ch);
                newChannels.push_back(transformed);
            }
        }
        this.channels.delete(); // fixme also delete individual channels??
        this.channels = newChannels;
    }
}
