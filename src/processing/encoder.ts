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

        this.image = new cv.Mat(width, height, cv.CV_32FC3)
        this.image.setTo(new cv.Scalar(0, .5, .5))
        this.bitsIter = bitsIter
        this.conf = conf;
        this.cv = cv
    }

    public encode() {
        // console.log('encoding')
        while (this.ch < 3) {
            this.encodeNextBlock();
        }

        let rgb32 = new this.cv.Mat();
        this.cv.cvtColor(this.image, rgb32, this.cv.COLOR_YCrCb2RGB)
        this.cv.min(rgb32, new this.cv.Mat(rgb32.rows, rgb32.cols, rgb32.type(), [1,1,1,0]), rgb32);
        this.cv.max(rgb32, new this.cv.Mat(rgb32.rows, rgb32.cols, rgb32.type(), [0,0,0,0]), rgb32);

        let rgb8 = new this.cv.Mat();
        rgb32.convertTo(rgb8, this.cv.CV_8U, 255);

        let ycrcb8 = new this.cv.Mat();
        this.image.convertTo(ycrcb8, this.cv.CV_8U, 255);

        return [ycrcb8, rgb8];
        // return [this.image, null];
    }

    private encodeNextBlock() {
        const dctMat = new this.cv.Mat(8, 8, this.cv.CV_32F);
        dctMat.setTo(new this.cv.Scalar(0))
        const conf = this.ch == 0 ? this.conf.lumaConf : this.conf.chromaConf;
        const tranform = this.ch == 0 ? this.conf.lumaDctToImageTransform : this.conf.chromaDctToImageTransform;
        conf.forEach((c: DctCoefConf) => {
            const byte = this.bitsIter.nextN(c.bitsCapacity) ?? 0;
            const max = (1 << c.bitsCapacity) - 1;
            // console.log('byte', byte, 'capacity', c.bitsCapacity, 'max', max)
            // dctMat.floatPtr(c.x, c.y)[0] = 0.33;

            dctMat.floatPtr(c.y, c.x)[0] = byte / max;
            // if (this.ch == 0) console.log('dct', c.x, c.y, this.ch, byte / max)
        })

        // for (let i = 0; i < 8; i++) {
        //     for (let j = 0; j < 8; j++) {
        //         if (this.ch != 0) continue;
        //         console.log('dct x=', j, ', y=', i, ', ch=', this.ch, ': ', dctMat.floatPtr(i, j)[0])
        //     }
        // }

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
                    * tranform.multiplier 
                    + tranform.addition);
                pixelValue = Math.max(0, Math.min(255, pixelValue))

                pixelValue = blockImage.floatPtr(y, x)[0]
                pixelValue = pixelValue
                    * tranform.multiplier 
                    + tranform.addition;

                // if (this.ch == 0) {
                //     const reverse = (pixelValue - this.conf.dctToImageTransform.addition) 
                //     / this.conf.dctToImageTransform.multiplier;
                //     console.log('blk value x=', x, ', y=', y, ': ', blockImage.floatPtr(y, x)[0], ' -> ', reverse)
                // }

                // if (this.ch !== 0) continue;
                this.image.floatPtr(this.y + y, this.x + x)[this.ch] = pixelValue;
                // console.log('put ', pixelValue, 'to', this.x + j, ' ', this.y + i, ' ', this.ch)
            }
        }

        // console.log('block encoded')
        
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
