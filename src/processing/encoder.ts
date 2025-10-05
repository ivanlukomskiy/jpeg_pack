import type { BitsIterator } from "./bits_iter";
import type { DctCoefConf, EncodingConf } from "./config";
import { idct8x8Mat } from "./dct";

export interface Encoder {
    encode: () => any;
}

export class EncoderImpl implements Encoder {
    private image: any;
    private bitsIter: BitsIterator;
    private conf: EncodingConf;
    private cv: any;
    private x: number = 0;
    private y: number = 0;
    private ch: number = 0;

    constructor(cv: any, width: number, height: number, bitsIter: BitsIterator, conf: EncodingConf) {

        this.image = new cv.Mat(width, height, cv.CV_8UC3)
        this.image.setTo(new cv.Scalar(0, 127, 127))
        this.bitsIter = bitsIter
        this.conf = conf;
        this.cv = cv
    }

    public encode() {
        while (this.ch < 3) {
            this.encodeNextBlock();
        }
        let res = new this.cv.Mat();
        this.cv.cvtColor(this.image, res, this.cv.COLOR_YCrCb2RGB);
        
        return [this.image, res];
        // return [this.image, null];
    }

    private encodeNextBlock() {
        const dctMat = new this.cv.Mat(8, 8, this.cv.CV_32F);
        dctMat.setTo(new this.cv.Scalar(0))
        const conf = this.ch == 0 ? this.conf.lumaConf : this.conf.chromaConf;
        conf.forEach((c: DctCoefConf) => {
            const byte = this.bitsIter.nextN(c.bitsCapacity) ?? 0;
            // THESE ARE ALWAYS DIFFERENT
            const max = (1 << c.bitsCapacity) - 1;
            // console.log('byte', byte, 'capacity', c.bitsCapacity, 'max', max)
            // dctMat.floatPtr(c.x, c.y)[0] = 0.33;
            dctMat.floatPtr(c.x, c.y)[0] = byte / max;
            console.log('dct set', c.x, c.y, this.ch, byte / max)
        })

        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.ch != 0) continue;
                console.log('dct x=', j, ', y=', i, ', ch=', this.ch, ': ', dctMat.floatPtr(i, j)[0])
            }
        }

        // const blockImage = new this.cv.Mat(8, 8, this.cv.CV_32F);
        const blockImage = idct8x8Mat(this.cv, dctMat);

        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {   
                // console.log('block image floats', i, j, blockImage.floatAt(i, j))
                // blockImage.floatPtr(i, j)[0] *= 255 // fixme multiplier should be configurable
            }
        }

        // const blockImageUint8 = new this.cv.Mat(8, 8, this.cv.CV_8U);
        // blockImage.convertTo(blockImageUint8, this.cv.CV_8U);
        
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                // const pixelValue = blockImageUint8.ucharPtr(i, j)[0];
                // fixme precompute these coefficients

                // fixme maybe round instead??
                let pixelValue = Math.round(blockImage.floatPtr(y, x)[0] 
                    * this.conf.dctToImageTransform.multiplier 
                    + this.conf.dctToImageTransform.addition);
                pixelValue = Math.max(0, Math.min(255, pixelValue))

                if (this.ch == 0) {
                    const reverse = (pixelValue - this.conf.dctToImageTransform.addition) 
                    / this.conf.dctToImageTransform.multiplier;
                    console.log('blk value x=', x, ', y=', y, ': ', blockImage.floatPtr(y, x)[0], ' -> ', reverse)
                }

                this.image.ucharPtr(this.y + y, this.x + x)[this.ch] = pixelValue;
                // console.log('put ', pixelValue, 'to', this.x + j, ' ', this.y + i, ' ', this.ch)
            }
        }
        
        blockImage.delete();
        // blockImageUint8.delete();

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
