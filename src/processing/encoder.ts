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
    }

    private encodeNextBlock() {
        const dctMat = new this.cv.Mat(8, 8, this.cv.CV_32F);
        dctMat.setTo(new this.cv.Scalar(0))
        const conf = this.ch == 0 ? this.conf.lumaConf : this.conf.chromaConf;
        const tranform = this.ch == 0 ? this.conf.lumaDctToImageTransform : this.conf.chromaDctToImageTransform;
        conf.forEach((c: DctCoefConf) => {
            const byte = this.bitsIter.nextN(c.bitsCapacity) ?? 0;
            const max = (1 << c.bitsCapacity) - 1;
            dctMat.floatPtr(c.y, c.x)[0] = byte / max;
        })

        const blockImage = idct8x8Mat(this.cv, dctMat);

        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                let pixelValue = blockImage.floatPtr(y, x)[0]
                pixelValue = pixelValue
                    * tranform.multiplier 
                    + tranform.addition;
                
                if (conf.length == 0) pixelValue = 0.5;
                this.image.floatPtr(this.y + y, this.x + x)[this.ch] = pixelValue;
            }
        }
        
        blockImage.delete();

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
