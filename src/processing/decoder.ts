import type { DctCoefConf, EncodingConf } from "./config";
import { dct8x8Mat } from "./dct";

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
    private res?: Uint8Array;

    constructor(cv: any, conf: EncodingConf) {
        this.conf = conf;
        this.cv = cv
    }

    decode(mat) {
        if (mat.rows % 8 != 0 || mat.cols % 8 != 0) {
            throw new Error("image dimensions should be multiples of 8")
        }
        let sizePerBlock = 0;
        this.conf.chromaConf.forEach(c => {
            sizePerBlock += c.bitsCapacity * 2
        })
        this.conf.lumaConf.forEach(c => {
            sizePerBlock += c.bitsCapacity
        })
        this.res = new Uint8Array(sizePerBlock * mat.rows / 8 * mat.cols / 8)
        
        let ycrcb = new this.cv.Mat();
        this.cv.cvtColor(mat, ycrcb, this.cv.COLOR_RGB2YCrCb);
        this.image = ycrcb;

        while (this.ch < 3) {
            this.decodeNextBlock();
            console.log("block decoded")
        }
    }

    private decodeNextBlock() {
        const block = new this.cv.Mat(8, 8, this.cv.CV_32F);
        
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const val = (this.image.ucharPtr(this.y + y, this.x + x)[this.ch] 
                - this.conf.dctToImageTransform.addition)
                / this.conf.dctToImageTransform.multiplier;

                block.floatPtr(y, x)[0] = val;
                if (this.ch == 0) {
                    console.log('blk value x=', x, ', y=', y, ', ch=', this.ch, ': ', val)
                }
                

                // let pixelValue = Math.floor(blockImage.floatPtr(i, j)[0] 
                //     * this.conf.dctToImageTransform.multiplier 
                //     + this.conf.dctToImageTransform.addition);
                // pixelValue = Math.max(0, Math.min(255, pixelValue))
                // this.image.ucharPtr(this.y + i, this.x + j)[this.ch] = pixelValue;
                // console.log('put ', val, 'to', this.x + j, ' ', this.y + i, ' ', this.ch)
            }
        }


        const conf = this.ch == 0 ? this.conf.lumaConf : this.conf.chromaConf;
        const dctMat = dct8x8Mat(block);

        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                if (this.ch != 0) continue;
                console.log('dct x=', x, ', y=', y, ', ch=', this.ch, ': ', dctMat.floatPtr(y, x)[0])
            }
        }

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
