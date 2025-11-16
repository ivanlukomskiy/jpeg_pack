import {Button, FileButton, Flex, NumberInput, Title, Typography} from "@mantine/core";
import {downloadMatAsJpeg, MatRender} from "../../components/mat_render/MatRender";
import {DefaultEncodingConf} from "../../processing/config";
import {DecoderImpl} from "../../processing/decoder";
import {useCallback, useMemo, useState} from "react";
import {useOpenCV} from "../../hooks/opencv";
import {decodeFile, getApproxEffectiveCapacityBytes} from "../../models/protocol";
import {
    decodeJpeg,
    deserializeMat,
    downloadFile,
    fileToUint8Array,
    generateTimestampedId,
    getJpegSubsampling, serializeMat
} from "../../processing/utils.ts";
import {buildDctConfStats} from "../../processing/blocks_iterator.ts";
import EncWorker from '../../workers/encoder?worker';
import DecWorker from '../../workers/decoder?worker';

export function EncodeFile() {
    const [encFile, setEncFile] = useState<File | null>(null);
    const [decFile, setDecFile] = useState<File | null>(null);
    const [res, setRes] = useState<any>(null)
    const cvLib = useOpenCV();
    const [w, setW] = useState(1024);
    const [h, setH] = useState(1024);

    const dctStats = useMemo(() => {
        return buildDctConfStats(DefaultEncodingConf);
    }, [])

    const encode = useCallback(async () => {
        if (!encFile) return;
        const worker = new EncWorker();
        worker.postMessage({
            type: 'start',
            data: {
                w,
                h,
                encFile
            }
        })
        worker.onmessage = (e: MessageEvent) => {
            console.log("got message from worker", e.data)
            const {type, data} = e.data;
            if (type === 'progress') {
                console.log('progress', data);
            } else if (type === 'result') {
                console.log('result received', data);
                const bgr32f = deserializeMat(data, cvLib.cv);
                setRes(bgr32f);
                downloadMatAsJpeg(bgr32f, generateTimestampedId() + ".jpeg", 0.95);
                worker.terminate();
            } else if (type === 'error') {
                console.error('error from worker', data);
                worker.terminate();
            }
        }
      }, [cvLib, w, h, encFile])



    const decode = useCallback(async () => {
        if (!decFile) return;
        const fileRawData = await fileToUint8Array(decFile);
        const ss = await getJpegSubsampling(decFile);
        console.log("subsampling info", ss)
        const {bgr32fDecoded} = await decodeJpeg(cvLib.cv, fileRawData);
        const serialized = serializeMat(bgr32fDecoded)
        const worker = new DecWorker();
        worker.postMessage({
            type: 'start',
            data: {
                bgrf32: serialized
            }
        })
        worker.onmessage = (e: MessageEvent) => {
            console.log("got message from worker", e.data)
            const {type, data} = e.data;
            if (type === 'progress') {
                console.log('progress', data);
            } else if (type === 'result') {
                console.log('result received', data);
                const bgr32f = deserializeMat(data.bgr32f, cvLib.cv);

                console.log(data.filename)
                downloadFile(data.filename, data.data)

                setRes(bgr32f);

                worker.terminate();
            } else if (type === 'error') {
                console.error('error from worker', data);
                worker.terminate();
            }
        }
      }, [cvLib, decFile])

    const onSetW = useCallback((e) => {
        setW(e);
    }, []);
    const onSetH = useCallback((e) => {
        setH(e);
    }, []);

    const capacityBytes = useMemo(() => {
        return w / 16 * h / 16 * dctStats.blockSizeBits / 8;
    }, [w, h, dctStats.blockSizeBits])

    const approxEffectiveCapacityBytes = useMemo(() => {
        return getApproxEffectiveCapacityBytes(capacityBytes);
    }, [capacityBytes]);
    
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
            <Typography>Bytes per 16x16 block: {dctStats.blockSizeBits / 8}</Typography>
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
