import type { DctCoefConf, EncodingConf } from "./config";
import { DctCalc } from "./dct";
import { Uint8ArrayBuilder } from "./uint_array_builder";

export interface Decoder {
    decode: (mat) => any;
}

export class DecoderImpl implements Decoder {
    private image: any;
    private conf: EncodingConf;
    private cv: any;
    private res?: Uint8ArrayBuilder;
    private channels: any;
    private height: number;

    // step-by-step matrices for debugging
    public dataMatrix: any;
    public ycrcb: any;
    public rgb32: any;
    public rgb8: any;
    public transformed: any;

    constructor(cv: any, conf: EncodingConf) {
        this.conf = conf;
        this.cv = cv
    }

    decode(rgb8uchar) {
        this.rgb8 = rgb8uchar;
        if (rgb8uchar.rows % 8 != 0 || rgb8uchar.cols % 8 != 0) {
            throw new Error(`image dimensions should be multiples of 8; got ${rgb8uchar.rows}x${rgb8uchar.cols}`)
        }
        this.height = rgb8uchar.rows;
        let bitsPerBlock = 0;
        this.conf.chromaConf.forEach(c => {
            bitsPerBlock += c.bitsCapacity * 2
        })
        this.conf.lumaConf.forEach(c => {
            bitsPerBlock += c.bitsCapacity
        })
        const expectedSize = bitsPerBlock * rgb8uchar.rows / 8 * rgb8uchar.cols / 8 / 8;
        this.res = new Uint8ArrayBuilder(expectedSize)

        this.rgb32 = new this.cv.Mat();
        rgb8uchar.convertTo(this.rgb32, this.cv.CV_32F, 1);
        // rgb8uchar.convertTo(this.rgb32, this.cv.CV_32F, 1/255.0);

        this.ycrcb = new this.cv.Mat();
        this.cv.cvtColor(this.rgb32, this.ycrcb, this.cv.COLOR_RGB2YCrCb);
        this.image = this.ycrcb;

        this.channels = new this.cv.MatVector();
        this.cv.split(this.image, this.channels);

        this.applyTransforms();

        this.transformed = new this.cv.Mat();
        this.cv.merge(this.channels, this.transformed);

        const dctCalc = new DctCalc(this.cv);
        dctCalc.init();
        this.inverseDct(dctCalc);
        // while (this.ch < 3) {
        //     this.decodeNextBlock(dctCalc);
        // }
        dctCalc.cleanup();

        this.dataMatrix = new this.cv.Mat();
        this.cv.merge(this.channels, this.dataMatrix);

        this.decodeDct();

        return this.res.toUint8Array();
    }

    private applyTransforms() {
        for (let i = 0; i < this.channels.size(); i++) {
            const ch = this.channels.get(i);
            const transform = i == 0 ? this.conf.lumaDctToImageTransform : this.conf.chromaDctToImageTransform;
            if (i == 0) {
                // ch.convertTo(ch, -1, 1, 0);   // ch = ch*30 + 10
                ch.convertTo(ch, -1, 1, -transform.addition);   // ch = ch*30 + 10
                ch.convertTo(ch, -1, 1/transform.multiplier, 0);   // ch = ch*30 + 10
            }
            this.channels.set(i, ch);
            ch.delete();
        }
    }

    private inverseDct(dct: DctCalc) {
        const newChannels = new this.cv.MatVector();
        for (let chIdx = 0; chIdx < 3; chIdx++) {
            const conf = chIdx == 0 ? this.conf.lumaConf : this.conf.chromaConf;
            const ch = this.channels.get(chIdx);
            if (conf.length == 0) { // make no changes
                newChannels.push_back(ch);
            } else {
                const transformed = dct.dct8x8Mat(ch);
                newChannels.push_back(transformed);
            }
        }
        this.channels.delete(); // fixme also delete individual channels??
        this.channels = newChannels;
        // console.log("this.channels", this.channels, this.channels.get(2))
    }

    private decodeDct() {
        let x=0, y=0, chIdx=0;

        while (y < this.height) {
            const ch = this.channels.get(chIdx);
            const conf = chIdx == 0 ? this.conf.lumaConf : this.conf.chromaConf;
            conf.forEach((c: DctCoefConf) => {
                const max = (1 << c.bitsCapacity) - 1;
                const dctCoef = ch.floatPtr(c.y + y, c.x + x)[chIdx];
                const value = Math.round(dctCoef * max);
                for (let i = c.bitsCapacity - 1; i >= 0; i--) {
                    const bitValue = (value >> i) & 1;
                    this.res?.addBit(bitValue);
                }
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
}
