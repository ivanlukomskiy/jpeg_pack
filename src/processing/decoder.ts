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
    private x: number = 0;
    private y: number = 0;
    private ch: number = 0;
    private res?: Uint8ArrayBuilder;

    constructor(cv: any, conf: EncodingConf) {
        this.conf = conf;
        this.cv = cv
    }

    decode(rgb8uchar) {
        if (rgb8uchar.rows % 8 != 0 || rgb8uchar.cols % 8 != 0) {
            throw new Error(`image dimensions should be multiples of 8; got ${rgb8uchar.rows}x${rgb8uchar.cols}`)
        }
        let bitsPerBlock = 0;
        this.conf.chromaConf.forEach(c => {
            bitsPerBlock += c.bitsCapacity * 2
        })
        this.conf.lumaConf.forEach(c => {
            bitsPerBlock += c.bitsCapacity
        })
        const expectedSize = bitsPerBlock * rgb8uchar.rows / 8 * rgb8uchar.cols / 8 / 8;
        this.res = new Uint8ArrayBuilder(expectedSize)

        const rgb32float = new this.cv.Mat();
        rgb8uchar.convertTo(rgb32float, this.cv.CV_32F, 1/255.0);
        
        const ycrcb = new this.cv.Mat();
        this.cv.cvtColor(rgb32float, ycrcb, this.cv.COLOR_RGB2YCrCb);
        this.image = ycrcb;

        const dctCalc = new DctCalc(this.cv);
        dctCalc.init();
        while (this.ch < 3) {
            this.decodeNextBlock(dctCalc);
        }
        dctCalc.cleanup();
        return this.res.toUint8Array();
    }

    private decodeNextBlock(dctCalc: DctCalc) {
        const block = new this.cv.Mat(8, 8, this.cv.CV_32F);
        const tranform = this.ch == 0 ? this.conf.lumaDctToImageTransform : this.conf.chromaDctToImageTransform;
        
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                let val = this.image.floatPtr(this.y + y, this.x + x)[this.ch];
                val = (val - tranform.addition) / tranform.multiplier;

                block.floatPtr(y, x)[0] = val;
            }
        }


        const conf = this.ch == 0 ? this.conf.lumaConf : this.conf.chromaConf;
        const dctMat = dctCalc.dct8x8Mat(block);

        conf.forEach((c: DctCoefConf) => {
            const max = (1 << c.bitsCapacity) - 1;
            const dctCoef = dctMat.floatAt(c.y, c.x);
            const value = Math.round(dctCoef * max);
            for (let i = c.bitsCapacity - 1; i >= 0; i--) {
                const bitValue = (value >> i) & 1;
                this.res?.addBit(bitValue);
            }
        })

        this.x += 8
        if (this.x >= this.image.cols) {
            this.x = 0;
            this.y += 8;
        }
        if (this.y >= this.image.rows) {
            this.x = 0;
            this.y = 0;
            this.ch += 1;
        }
    }
}
