import { Button, FileButton, FileInput, Flex, NumberInput, SegmentedControl, Textarea, Title, Typography } from "@mantine/core";
import { downloadMatAsJpeg, MatRender } from "../../components/mat_render/MatRender";
import { DefaultEncodingConf } from "../../processing/config";
import { BitsIteratorImpl, compareBits, randomUint8Arr } from "../../processing/bits_iter";
import { EncoderImpl } from "../../processing/encoder";
import { DecoderImpl } from "../../processing/decoder";
import { useCallback, useMemo, useState } from "react";
import { useOpenCV } from "../../hooks/opencv";
import { sampleText } from "../../processing/sample_text";
import { addErrorCorrection, decodeErrorCorrection } from "../../processing/reed_solomon/adapter";
import { decodeFile, encodeFile, getApproxEffectiveCapacityBytes } from "../../models/protocol";
import {getJpegSubsampling} from "../../processing/utils.ts";
import {buildDctConfStats} from "../../processing/blocks_iterator.ts";

export function fileToUint8Array(file: File): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (event: any) => {
            const arrayBuffer = event.target.result;
            const uint8Array = new Uint8Array(arrayBuffer);
            resolve(uint8Array);
        };
        
        reader.onerror = (error) => {
            reject(error);
        };
        
        reader.readAsArrayBuffer(file);
    });
}
function generateTimestampedId() {
    // Get current date in YYYY-MM-DD format
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // "YYYY-MM-DD"
    
    // Generate random 8-character alphanumeric string
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomStr = '';
    for (let i = 0; i < 8; i++) {
        randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return `${dateStr}-${randomStr}`;
}

// Usage
const id = generateTimestampedId(); // "2024-01-15-aB3d9fG7"

// rgb8: CV_8UC3 (RGB), range 0..255
async function decodeJpeg(cv, jpegBytes: Uint8Array) {
    const blob = new Blob([jpegBytes], { type: 'image/jpeg' });

    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    await img.decode();

    const decCanvas = document.createElement('canvas');
    decCanvas.width = img.naturalWidth;
    decCanvas.height = img.naturalHeight;
    const dctx = decCanvas.getContext('2d');
    dctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    // 5) Read pixels back to Mat (RGBA) without cv.imread
    const imageData = dctx.getImageData(0, 0, decCanvas.width, decCanvas.height);
    const rgbaDec = cv.matFromImageData(imageData);

    // 6) RGBA -> RGB Mat (uint8)
    const rgb8Decoded = new cv.Mat();
    cv.cvtColor(rgbaDec, rgb8Decoded, cv.COLOR_RGBA2RGB);
    rgbaDec.delete();

    // 7) Convert RGB uint8 to RGB float32 (CV_32FC3), normalize to [0, 1]
    const rgb32fDecoded = new cv.Mat();
    rgb8Decoded.convertTo(rgb32fDecoded, cv.CV_32F, 1.0 / 255.0);
    rgb8Decoded.delete();

    return { rgb32fDecoded, blob };
}

function downloadFile(filename: string, data: Uint8Array) {
    // Create blob from Uint8Array
    const blob = new Blob([data]);
    
    // Create object URL
    const url = URL.createObjectURL(blob);
    
    // Create hidden link
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
}

export function EncodeFile() {
    const [encFile, setEncFile] = useState<File | null>(null);
    const [decFile, setDecFile] = useState<File | null>(null);
    const [res, setRes] = useState<any>(null)
    const cvLib = useOpenCV();
    const [w, setW] = useState(1072);
    const [h, setH] = useState(1072);
    const [inpText, setInpText] = useState(sampleText)

    const dctStats = useMemo(() => {
        return buildDctConfStats(DefaultEncodingConf);
    }, [])

    const encode = useCallback(async () => {
        if (!encFile) return;
        const data = await fileToUint8Array(encFile);
        const encoded = await encodeFile(encFile.name, data)
    
        const iter = BitsIteratorImpl.fromBytes(encoded)
        const encoder = new EncoderImpl(cvLib.cv, w, h, iter, DefaultEncodingConf)
        const res = encoder.encode();
    
        //   let {rgb8Decoded} = await jpegRoundTrip(cvLib.cv, res, 95);
        //   console.log('rgb8Decoded', rgb8Decoded)
    
        //   const decoder = new DecoderImpl(cvLib.cv, DefaultEncodingConf)
        //   const decoded = decoder.decode(rgb8Decoded);
          setRes(res);
        //   console.log('encoded')
          downloadMatAsJpeg(res, generateTimestampedId() + ".jpeg", 0.1);
     
        // console.log('median errors fraction', getMedian(rates))
      }, [cvLib, w, h, encFile])



    const decode = useCallback(async () => {
        if (!decFile) return;
        const data = await fileToUint8Array(decFile);
        const ss = await getJpegSubsampling(decFile)
        console.log("subsampling info", ss)
        const {rgb32fDecoded} = await decodeJpeg(cvLib.cv, data);

        const decoder = new DecoderImpl(cvLib.cv, DefaultEncodingConf)
        const decoded = decoder.decode(rgb32fDecoded);
        const [filename, fileData] = await decodeFile(decoded);
        console.log(filename)
        downloadFile(filename, fileData)
          setRes(rgb32fDecoded);
        //   console.log('decoded')
     
        // console.log('median errors fraction', getMedian(rates))
      }, [cvLib, decFile])

    const onSetW = useCallback((e) => {
        setW(e);
    }, []);
    const onSetH = useCallback((e) => {
        setH(e);
    }, []);

    const onSetInpText = useCallback((e) => {
        setInpText(e.target.value);
    }, []);

    const capacityBytes = useMemo(() => {
        return w / 16 * h / 16 * dctStats.blockSizeBits / 8;
    }, [w, h, dctStats.blockSizeBits])

    const approxEffectiveCapacityBytes = useMemo(() => {
        return getApproxEffectiveCapacityBytes(capacityBytes);
    }, [capacityBytes]);

    const usedBytes = useMemo(() => {
        const encoder = new TextEncoder();
        const data = encoder.encode(inpText);
        return data.length;
    }, [inpText])
    
      return (
        <Flex direction={'row'} gap={'xl'} justify={'center'}>
          {!res && <Flex direction={'column'} gap={'sm'} style={{alignItems: 'left', width: '200px'}}>
            <Title size={'lg'}>Encode</Title>
            <NumberInput label={'width'} hideControls min={8} max={1080} value={w} onChange={onSetW} />
            <NumberInput label={'height'} hideControls min={8} max={1080} value={h} onChange={onSetH} />
            {encFile?.name}
            <FileButton onChange={setEncFile} >
            {(props) => <Button {...props}>Choose file</Button>}
            </FileButton>
            <Button onClick={encode} disabled={!encFile}>
              Encode
            </Button>
          </Flex>}
          {!res && <Flex direction={'column'} gap={'sm'} style={{paddingTop: '55px', alignItems: 'flex-start', marginRight: '60px'}}>
            {/* <Title size={'lg'}>Details</Title> */}
            <Typography>Capacity: {(capacityBytes / 1024).toFixed(2)} KB</Typography>
            <Typography>Effective: ~{(approxEffectiveCapacityBytes / 1024).toFixed(2)} KB</Typography>
            {/* <Typography>Used: {(usedBytes / 1024).toFixed(2)} KB</Typography> */}
            <Typography>Bytes per 16x16 block: {dctStats.blockSizeBits}</Typography>
          </Flex>}

          {!res && <Flex direction={'column'} gap={'sm'} style={{alignItems: 'left', width: '200px'}}>
            <Title size={'lg'}>Decode</Title>
            {decFile?.name}
            <FileButton onChange={setDecFile} accept="image/png,image/jpeg">
            {(props) => <Button {...props}>Choose image</Button>}
            </FileButton>
            <Button onClick={decode} disabled={!decFile}>
              Decode
            </Button>
          </Flex>}
          {res && <Flex direction={'column'} gap={'sm'}>
            <Title size={'lg'}>Result</Title>
            <MatRender mat={res} size={512} />
          </Flex>}
          
        </Flex>
      )
}
