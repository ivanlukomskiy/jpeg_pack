import {getOpenCv} from "../hooks/opencv.ts";
import {EncoderImpl} from "../processing/encoder.ts";
import {DefaultEncodingConf} from "../processing/config.ts";
import {BitsIteratorImpl} from "../processing/bits_iter.ts";
import {encodeFile} from "../models/protocol.ts";
import {fileToUint8Array, serializeMat} from "../processing/utils.ts";

let cv: any = null;

self.onmessage = async function(event) {
    const { type, data } = event.data;
    if (!cv) {
        const cvModule = await getOpenCv();
        console.log("cvModule", cvModule.cv)
        cv = cvModule.cv;
    }

    if (type === 'start') {
        try {
            self.postMessage({
                type: 'progress',
                data: 0
            });
            const {w, h, encFile} = data;

            const fileRawData = await fileToUint8Array(encFile);
            const encodedFileData = await encodeFile(encFile.name, fileRawData)
            const iterator = BitsIteratorImpl.fromBytes(encodedFileData)
            const encoder =  new EncoderImpl(cv, w, h, iterator, DefaultEncodingConf)

            const bgr32f = await encoder.encode();
            console.log("bgr32f", bgr32f)
            const serialized = serializeMat(bgr32f)
            self.postMessage({
                type: 'result',
                data: serialized
            });

        } catch (error) {
            self.postMessage({
                type: 'error',
                data: error
            });
        }
    }
};