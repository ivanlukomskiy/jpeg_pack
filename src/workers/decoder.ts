import {getOpenCv} from "../hooks/opencv.ts";
import {DefaultEncodingConf} from "../processing/config.ts";
import {decodeFile} from "../models/protocol.ts";
import {deserializeMat, serializeMat} from "../processing/utils.ts";
import {DecoderImpl} from "../processing/decoder.ts";
import {start} from "node:repl";

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
            console.log("start", data)
            self.postMessage({
                type: 'progress',
                data: 0
            });
            const {bgrf32} = data;
            const bgr32fDecoded = deserializeMat(bgrf32, cv);

            // const fileRawData = await fileToUint8Array(decFile);
            // const ss = await getJpegSubsampling(decFile);
            // console.log("subsampling info", ss)
            // console.log("fileRawData", fileRawData)
            // const {bgr32fDecoded} = await decodeJpeg(cv, fileRawData);
            const decoder = new DecoderImpl(cv, DefaultEncodingConf)
            const decoded = decoder.decode(bgr32fDecoded);
            const res = await decodeFile(decoded);
            const serialized = serializeMat(bgr32fDecoded)

            self.postMessage({
                type: 'result',
                data: {
                    filename: res.filename,
                    data: res.data,
                    bgr32f: serialized
                },
            });

        } catch (error) {
            self.postMessage({
                type: 'error',
                data: error
            });
        }
    }
};