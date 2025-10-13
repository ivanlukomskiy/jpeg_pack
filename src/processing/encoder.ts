import type { BitsIterator } from "./bits_iter";
import type { DctCoefConf, EncodingConf } from "./config";
import { DctCalc } from "./dct";

export interface Encoder {
    encode: () => any;
}

export class EncoderImpl implements Encoder {
    private image: any;
    private channels: any;
    private bitsIter: BitsIterator;
    private conf: EncodingConf;
    private cv: any;
    private x: number = 0;
    private y: number = 0;
    private ch: number = 0;

    // step-by-step matrices for debugging
    public dataMatrix: any;
    public dataMatrixWithTransforms: any;
    public ycrcb: any;
    public rgb32: any;
    public prime: any;

    constructor(cv: any, width: number, height: number, bitsIter: BitsIterator, conf: EncodingConf) {
        this.channels = new cv.MatVector();
        for (let i = 0; i < 3; i++) {
            const val = i == 0 ? 0 : .5;
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

        // this.applyTransforms();
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

        this.rgb32 = new this.cv.Mat();
        this.cv.cvtColor(this.ycrcb, this.rgb32, this.cv.COLOR_YCrCb2BGR)
        this.cv.min(this.rgb32, new this.cv.Mat(this.rgb32.rows, this.rgb32.cols, this.rgb32.type(), [1,1,1,0]), this.rgb32);
        this.cv.max(this.rgb32, new this.cv.Mat(this.rgb32.rows, this.rgb32.cols, this.rgb32.type(), [0,0,0,0]), this.rgb32);

        return this.rgb32;
        // const rgb8 = new this.cv.Mat();
        // this.rgb32.convertTo(rgb8, this.cv.CV_8U, 255);
        //
        // return rgb8;
    }

    private populateDctMatrix() {
        let x=0, y=0, chIdx=0;
        while (chIdx < 3) {
            const ch = this.channels.get(chIdx);
            const conf = chIdx == 0 ? this.conf.lumaConf : this.conf.chromaConf;
            const transform = chIdx == 0 ? this.conf.lumaDctToImageTransform : this.conf.chromaDctToImageTransform;
            conf.forEach((c: DctCoefConf) => {
                const byte = this.bitsIter.nextN(c.bitsCapacity) ?? 0;
                const max = (1 << c.bitsCapacity) - 1;
                const val = byte / max;
                const withTransform = val * transform.multiplier + transform.addition;
                ch.floatPtr(c.y + y, c.x + x)[0] = withTransform;
                console.log('stored ', c.y + y, c.x + x, chIdx, byte / max)
            })
            // fixme i can do better
            x += 8
            if (x >= ch.cols) {
                x = 0;
                y += 8;
            }
            if (y >= ch.rows) {
                x = 0;
                y = 0;
                chIdx += 1;
            }
        }
    }

    private applyTransforms() {
        for (let chIdx = 0; chIdx < 3; chIdx++) {
            const conf = chIdx == 0 ? this.conf.lumaConf : this.conf.chromaConf;
            if (conf.length == 0) continue;
            const tranform = this.ch == 0 ? this.conf.lumaDctToImageTransform : this.conf.chromaDctToImageTransform;
            const ch = this.channels.get(chIdx);
            console.log(ch.floatPtr(3,3)[0])
            this.cv.addWeighted(ch, tranform.multiplier, ch, 0, tranform.addition, ch);
            console.log(ch.floatPtr(3,3)[0])
            // this.cv.multiply(ch, new this.cv.Scalar(tranform.multiplier), ch);
            // this.cv.add(ch, new this.cv.Scalar(tranform.addition), ch);
            // ch.convertTo(ch, this.cv.CV_32F, tranform.multiplier, tranform.addition * tranform.multiplier);
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


    private encodeNextBlock(dctCalc: DctCalc) { // deprecated
        const dctMat = new this.cv.Mat(8, 8, this.cv.CV_32F);
        dctMat.setTo(new this.cv.Scalar(0))
        const conf = this.ch == 0 ? this.conf.lumaConf : this.conf.chromaConf;
        const tranform = this.ch == 0 ? this.conf.lumaDctToImageTransform : this.conf.chromaDctToImageTransform;
        conf.forEach((c: DctCoefConf) => {
            const byte = this.bitsIter.nextN(c.bitsCapacity) ?? 0;
            const max = (1 << c.bitsCapacity) - 1;
            dctMat.floatPtr(c.y, c.x)[0] = byte / max;
        })

        const blockImage = dctCalc.idct8x8Mat(dctMat);

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
