import type { BitsIterator } from "./bits_iter";
import type { DctCoefConf, EncodingConf } from "./config";
import { DctCalc } from "./dct";

export interface Encoder {
    encode: () => any;
}

type Mat32FC1 = any;
type MatVector = any;

export class EncoderImpl implements Encoder {
    private channels: MatVector;
    private bitsIter: BitsIterator;
    private conf: EncodingConf;
    private cv: any;
    private height: number;
    private width: number;

    // step-by-step matrices for debugging
    private dataMatrix: Mat32FC1 | null;
    private ycrcb: Mat32FC1 | null;
    private transformed: Mat32FC1 | null;
    private bgr32f: Mat32FC1 | null;
    private prime: Mat32FC1 | null;

    constructor(cv: any, width: number, height: number, bitsIter: BitsIterator, conf: EncodingConf) {
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
        // this.prime = this.snapshot();

        this.populateDctMatrix();
        // this.dataMatrix = this.snapshot();
        console.log('data matrix shapshot ok')

        // const dctCalc = new DctCalc(this.cv);
        console.log('dct constructor ok')
        // dctCalc.init()
        console.log('applying dct')
        // this.applyDct(dctCalc);
        console.log('dct apply ok')
        // while (this.ch < 3) {
        //     this.encodeNextBlock(dctCalc);
        // }
        // dctCalc.cleanup();
        console.log('dct cleanup ok')
        // this.ycrcb = this.snapshot();
        console.log('ycrcb snapshot ok')


        // this.applyTransforms();
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

        this.transformed.delete();
        this.bgr32f.delete();
        this.channels.get(0).delete();
        this.channels.get(1).delete();
        this.channels.get(2).delete();
        this.channels.delete();

        // return this.bgr32f;
        // const rgb8 = new this.cv.Mat();
        // this.rgb32.convertTo(rgb8, this.cv.CV_8U, 255);
        //
        // return rgb8;
    }

    private populateDctMatrix() {
        let x=0, y=0, chIdx=0;
        console.log('populating')
        while (y < this.height) {
            const downsampling = chIdx == 0 ? 1 : 2;
            console.log('downsampling', downsampling, 'ch', chIdx, 'xy', x, y, 'x % downsampling', x % downsampling);
            if ((x / 8) % downsampling === 0 && (y / 8) % downsampling === 0) {

            const ch = this.channels.get(chIdx);
            const conf = chIdx == 0 ? this.conf.lumaConf : this.conf.chromaConf;
            // const transform = chIdx == 0 ? this.conf.lumaDctToImageTransform : this.conf.chromaDctToImageTransform;
            conf.forEach((c: DctCoefConf) => {
                const byte = this.bitsIter.nextN(c.bitsCapacity) ?? 0;
                const max = (1 << c.bitsCapacity) - 1;
                const val = byte / max;
                // const withTransform = val * transform.multiplier + transform.addition;
                // ch.floatPtr(c.y + y, c.x + x)[0] = withTransform;
                ch.floatPtr(c.y / downsampling + y, c.x / downsampling + x)[0] = val;
                console.log('stored ', c.x / downsampling + x, c.y / downsampling + y, chIdx, 'orig', byte, 'frac', val)
            })
            }
            // fixme i can do better
            chIdx++;
            if (chIdx >= 3) {
                x += 8;
                chIdx = 0;
                if (x >= this.width) {
                    x = 0;
                    y += 8;
                }
            }
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
