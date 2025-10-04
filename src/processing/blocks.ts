
export interface Encoder {
    encode: (data: number[]) => any;
}


export function generateBlock(cv: any, image: any, channel: number, bitsIter: BitsIter, conf: DctCoefConf[]) {
    const dctMat = new cv.Mat(8, 8, cv.CV_32F);
    
}