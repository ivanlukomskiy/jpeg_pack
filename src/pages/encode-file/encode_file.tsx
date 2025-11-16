import {Button, FileButton, Flex, Loader, NumberInput, Text, Title} from "@mantine/core";
import {downloadMatAsJpeg, MatRender} from "../../components/mat_render/MatRender";
import {DefaultEncodingConf} from "../../processing/config";
import {useCallback, useEffect, useMemo, useState} from "react";
import {useOpenCV} from "../../hooks/opencv";
import {getApproxEffectiveCapacityBytes} from "../../models/protocol";
import {
    decodeJpeg,
    deserializeMat,
    downloadFile,
    fileToUint8Array,
    generateTimestampedId,
    getJpegSubsampling,
    serializeMat
} from "../../processing/utils.ts";
import {buildDctConfStats} from "../../processing/blocks_iterator.ts";
import EncWorker from '../../workers/worker_encoder.ts?worker';
import DecWorker from '../../workers/worker_decoder.ts?worker';
import {EncodingStepDesc, type StepStatus, StepStatusCode} from "../../processing/progress.ts";

function getStepIcon(status: number) {
    let icon = null;
    let color = 'inherit';
    switch (status) {
        case StepStatusCode.COMPLETED:
            icon = '✓';
            color = 'green';
            break;
        case StepStatusCode.IN_PROGRESS:
            icon = <Loader size={12}></Loader>;
            break;
        case StepStatusCode.FAILED:
            icon = 'X';
            color = 'red';
            break;
        case StepStatusCode.PENDING:
            icon = '·';
            break;
    }
    return <div style={{fontWeight: 'bold', width: '20px', color, flexShrink: '0'}}>{icon}</div>
}

const stepTextColorMap = {
    [StepStatusCode.COMPLETED]: 'green',
    [StepStatusCode.IN_PROGRESS]: 'black',
    [StepStatusCode.FAILED]: 'red',
    [StepStatusCode.PENDING]: 'gray',
}

export function EncodeFile() {
    const [encFile, setEncFile] = useState<File | null>(null);
    const [decFile, setDecFile] = useState<File | null>(null);
    const [res, setRes] = useState<any>(null)
    const cvLib = useOpenCV();
    const [w, setW] = useState(1024);
    const [h, setH] = useState(1024);
    const [progress, setProgress] = useState<Record<string, StepStatus> | null>();

    const dctStats = useMemo(() => {
        return buildDctConfStats(DefaultEncodingConf);
    }, [])

    const updateProgress = useCallback((prog: Record<number, StepStatus>, descMap: Record<number, string>) => {
        const out: Record<string, StepStatus> = {};
        for (const step in prog) {
            const stepNum = parseInt(step);
            out[descMap[stepNum]] = prog[stepNum];
        }
        setProgress(out);
    }, []);

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
                const progress = data as Record<number, StepStatus>;
                updateProgress(progress, EncodingStepDesc)
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
      }, [encFile, w, h, updateProgress, cvLib.cv])



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

    const detailsLine = useCallback((title: string, value: string, invalid: boolean = false) => {
        return (<Flex direction={'row'} justify={'space-between'}>
            <Text size={'sm'} style={{color: '#434343'}}>{title}</Text>
            <Text size={'sm'} style={{color: invalid ? 'red' : 'inherit'}}>{value}</Text>
        </Flex>)
    }, []);

    const details = useMemo(() => {
        return (
            <Flex direction={'column'} gap={'sm'} style={{padding: '5px'}}>
              {detailsLine('16x16 block', (dctStats.blockSizeBits / 8).toString() + ' bytes')}
              {detailsLine('capacity', (capacityBytes / 1024).toFixed(2) + ' KB')}
              {detailsLine('effective', approxEffectiveCapacityBytes > 0 ? '~'
                  + (approxEffectiveCapacityBytes / 1024).toFixed(2)
                  + ' KB' : 'N/A', approxEffectiveCapacityBytes <= 0)}
            </Flex>
        )
    }, [approxEffectiveCapacityBytes, capacityBytes, dctStats.blockSizeBits, detailsLine]);

    const progressTable = useMemo(() => {
        if (!progress) return null;
        return (
            <Flex direction={'column'}>
                {Object.keys(progress).map((key) => {
                    const step = progress[key];
                    return (<Flex direction={'row'} key={key} style={{width: '250px'}} gap={'xs'} justify={'space-between'}>
                        <Flex direction={'row'} gap={'xs'} style={{flexShrink: 1}}>
                            {getStepIcon(step.code)}
                            <Flex direction={'column'} style={{textAlign: 'left', flexShrink: 1}}>
                                <Text style={{color: stepTextColorMap[step.code]}}>{key}</Text>
                                {step.error && <Text style={{color: 'red'}} size={'xs'}>{step.error}</Text>}
                            </Flex>
                        </Flex>
                        <Text style={{color: 'darkgray', paddingTop: 2, flexShrink: 0}} size={'sm'}>
                            {step.endTime && step.startTime ? step.endTime - step.startTime + ' ms' : ''}
                        </Text>
                    </Flex>)
                })}
            </Flex>
        )
    }, [progress])

    useEffect(() => {
        setProgress({
           'Completed step': {code: StepStatusCode.COMPLETED, startTime: Date.now(), endTime: Date.now() + 44},
           'In progress step': {code: StepStatusCode.IN_PROGRESS, startTime: Date.now()},
            'Failed step': {code: StepStatusCode.FAILED, startTime: Date.now(), endTime: Date.now() + 33, error: 'oh no! there were some nasty errors'},
           'Pending step': {code: StepStatusCode.PENDING},
        });
    }, [])
    
      return (
        <Flex direction={'row'} gap={'xl'} justify={'center'}>
          {!res && !progress && <Flex direction={'column'} gap={'sm'} style={{alignItems: 'left', width: '200px'}}>
            <Title size={'lg'}>Encode</Title>
            <NumberInput label={'width'} hideControls min={8} max={1080} value={w} onChange={onSetW} />
            <NumberInput label={'height'} hideControls min={8} max={1080} value={h} onChange={onSetH} />
              {details}
            {encFile?.name}
            <FileButton onChange={setEncFile} >
            {(props) => <Button {...props}>Choose file</Button>}
            </FileButton>
            <Button onClick={encode} disabled={!encFile}>
              Encode
            </Button>
          </Flex>}
          {!res && <Flex direction={'column'} gap={'sm'} style={{paddingTop: '55px', alignItems: 'flex-start', marginRight: '60px'}}>
          </Flex>}

          {!res && !progress && <Flex direction={'column'} gap={'sm'} style={{alignItems: 'left', width: '200px'}}>
            <Title size={'lg'}>Decode</Title>
            {decFile?.name}
            <FileButton onChange={setDecFile} accept="image/png,image/jpeg">
            {(props) => <Button {...props}>Choose image</Button>}
            </FileButton>
            <Button onClick={decode} disabled={!decFile}>
              Decode
            </Button>
          </Flex>}

            {progress && progressTable}

          {res && <Flex direction={'column'} gap={'sm'}>
            <Title size={'lg'}>Result</Title>
            <MatRender mat={res} size={512} />
          </Flex>}
          
        </Flex>
      )
}
