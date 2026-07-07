import { Button, FileButton, Flex, Loader, NumberInput, Text, Title } from '@mantine/core';
import { DefaultEncodingConf } from '../../processing/config';
import { useCallback, useMemo, useState } from 'react';
import { useOpenCV } from '../../hooks/opencv';
import { encodeFile, getApproxEffectiveCapacityBytes, getFullByteCapacity } from '../../models/protocol';
import { compareBits, compareBytes } from '../../processing/bits_iter';
import { DecoderImpl } from '../../processing/decoder';
import { decodeErrorCorrection } from '../../processing/reed_solomon/adapter';
import {
  decodeJpeg,
  deserializeMat,
  downloadFile,
  fileToUint8Array,
  generateTimestampedId,
  getJpegSubsampling,
  matToJpegFileResult,
  serializeMat,
} from '../../processing/utils.ts';
import { buildDctConfStats } from '../../processing/blocks_iterator.ts';
import EncWorker from '../../workers/worker_encoder.ts?worker';
import DecWorker from '../../workers/worker_decoder.ts?worker';
import {
  createDecodingProgressTracker,
  createEncodingProgressTracker,
  DecodingStep,
  DecodingStepDesc,
  EncodingStep,
  EncodingStepDesc,
  type StepStatus,
  StepStatusCode,
} from '../../processing/progress.ts';

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
  return <div style={{ fontWeight: 'bold', width: '20px', color, flexShrink: '0' }}>{icon}</div>;
}

const stepTextColorMap = {
  [StepStatusCode.COMPLETED]: 'green',
  [StepStatusCode.IN_PROGRESS]: 'black',
  [StepStatusCode.FAILED]: 'red',
  [StepStatusCode.PENDING]: 'gray',
};

function validateDimension(value: number) {
  if (value <= 0) return 'Must be a positive integer';
  if (value % 16 != 0) return 'Must be a multiple of 16';
  return null;
}

export function EncodeFile() {
  const [encFile, setEncFile] = useState<File | null>(null);
  const [decFile, setDecFile] = useState<File | null>(null);
  const cvLib = useOpenCV();
  const [w, setW] = useState(1024);
  const [h, setH] = useState(1024);
  // const [w, setW] = useState(1024);
  // const [h, setH] = useState(1024);
  const [progress, setProgress] = useState<Record<string, StepStatus> | null>();
  const [resultFile, setResultFile] = useState<Uint8Array | null>(null);
  const [resultFileName, setResultFileName] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const dctStats = useMemo(() => {
    return buildDctConfStats(DefaultEncodingConf);
  }, []);

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
        encFile,
      },
    });
    let lastProgress: Record<number, StepStatus> = {};
    worker.onmessage = async (e: MessageEvent) => {
      const { type, data } = e.data;
      if (type === 'progress') {
        const progress = data as Record<number, StepStatus>;
        lastProgress = progress;
        updateProgress(progress, EncodingStepDesc);
      } else if (type === 'result') {
        const tracker = createEncodingProgressTracker(lastProgress);
        tracker.markInProgress(EncodingStep.CREATE_IMAGE);
        updateProgress(tracker.serialize(), EncodingStepDesc);
        try {
          const bgr32f = deserializeMat(data, cvLib.cv);
          const fileRes = await matToJpegFileResult(bgr32f, generateTimestampedId() + '.jpeg', 0.95);
          downloadFile(fileRes.filename, fileRes.data);
          setResultFile(fileRes.data);
          setResultFileName(fileRes.filename);
          tracker.markCurrentStepCompleted();
          updateProgress(tracker.serialize(), EncodingStepDesc);
        } catch (e) {
          tracker.markCurrentStepFailed((e as Error).message);
          updateProgress(tracker.serialize(), EncodingStepDesc);
        }
        worker.terminate();
      } else if (type === 'error') {
        console.error('error from worker', data);
        worker.terminate();
      }
    };
  }, [encFile, w, h, updateProgress, cvLib.cv]);

  const decode = useCallback(async () => {
    if (!decFile) return;
    let tracker = createDecodingProgressTracker();

    tracker.markInProgress(DecodingStep.LOAD_IMAGE);
    updateProgress(tracker.serialize(), DecodingStepDesc);

    let bgr32fDecoded: any = null;
    let serialized: any;
    try {
      const fileRawData = await fileToUint8Array(decFile);
      const ss = await getJpegSubsampling(decFile);
      console.log('subsampling info', ss);
      const jpegDecodeResult = await decodeJpeg(cvLib.cv, fileRawData);
      bgr32fDecoded = jpegDecodeResult.bgr32fDecoded;
      tracker.markCurrentStepCompleted();
      updateProgress(tracker.serialize(), DecodingStepDesc);
      serialized = serializeMat(bgr32fDecoded);
    } catch (e) {
      tracker.markCurrentStepFailed((e as Error).message);
      updateProgress(tracker.serialize(), DecodingStepDesc);
      return;
    }

    const worker = new DecWorker();
    let lastProgress: Record<number, StepStatus> = {};
    worker.postMessage({
      type: 'start',
      data: {
        bgrf32: serialized,
        trackerState: tracker.serialize(),
      },
    });
    worker.onmessage = (e: MessageEvent) => {
      const { type, data } = e.data;
      if (type === 'progress') {
        const progress = data as Record<number, StepStatus>;
        lastProgress = progress;
        updateProgress(progress, DecodingStepDesc);
      } else if (type === 'result') {
        console.log(data.filename);
        tracker = createDecodingProgressTracker(lastProgress);
        updateProgress(tracker.serialize(), DecodingStepDesc);
        downloadFile(data.filename, data.data);
        setResultFile(data.data);
        setResultFileName(data.filename);
        tracker.markCurrentStepCompleted();
        updateProgress(tracker.serialize(), DecodingStepDesc);
        worker.terminate();
      } else if (type === 'error') {
        console.error('error from worker', data);
        worker.terminate();
      }
    };
  }, [cvLib.cv, decFile, updateProgress]);

  const onSetW = useCallback((e: any) => {
    setW(e);
  }, []);
  const onSetH = useCallback((e: any) => {
    setH(e);
  }, []);

  const capacityBytes = useMemo(() => {
    return getFullByteCapacity(w, h);
  }, [w, h]);

  const approxEffectiveCapacityBytes = useMemo(() => {
    return getApproxEffectiveCapacityBytes(capacityBytes);
  }, [capacityBytes]);

  const detailsLine = useCallback((title: string, value: string, invalid: boolean = false) => {
    return (
      <Flex direction={'row'} justify={'space-between'}>
        <Text size={'sm'} style={{ color: '#434343' }}>
          {title}
        </Text>
        <Text size={'sm'} style={{ color: invalid ? 'red' : 'inherit' }}>
          {value}
        </Text>
      </Flex>
    );
  }, []);

  const details = useMemo(() => {
    return (
      <Flex direction={'column'} gap={'sm'} style={{ padding: '5px' }}>
        {detailsLine('16x16 block', (dctStats.blockSizeBits / 8).toString() + ' bytes')}
        {detailsLine('capacity', (capacityBytes / 1024).toFixed(2) + ' KB')}
        {detailsLine(
          'effective',
          approxEffectiveCapacityBytes > 0 ? '~' + (approxEffectiveCapacityBytes / 1024).toFixed(2) + ' KB' : 'N/A',
          approxEffectiveCapacityBytes <= 0,
        )}
      </Flex>
    );
  }, [approxEffectiveCapacityBytes, capacityBytes, dctStats.blockSizeBits, detailsLine]);

  const download = useCallback(() => {
    if (!resultFile || !resultFileName) return;
    downloadFile(resultFileName, resultFile);
  }, [resultFile, resultFileName]);

  const reset = useCallback(() => {
    setResultFile(null);
    setResultFileName(null);
    setProgress(null);
    setEncFile(null);
    setDecFile(null);
  }, []);

  const test = useCallback(async () => {
    if (!resultFile || !encFile || !cvLib.cv) return;
    setIsTesting(true);
    try {
      const fileRawData = await fileToUint8Array(encFile);
      const rsByteCapacity = getFullByteCapacity(w, h);
      const expected = await encodeFile(encFile.name, fileRawData, rsByteCapacity);

      const { bgr32fDecoded } = await decodeJpeg(cvLib.cv, resultFile);
      const decoder = new DecoderImpl(cvLib.cv, DefaultEncodingConf);
      const fullDecoded = decoder.decode(bgr32fDecoded);
      const decoded = fullDecoded.subarray(0, expected.length);

      const totalBits = expected.length * 8;
      const bitErrors = compareBits(expected, decoded);
      const byteErrors = compareBytes(expected, decoded);

      console.log(
        `test: bit errors = ${bitErrors} / ${totalBits} (${((bitErrors / totalBits) * 100).toFixed(2)}%)`,
      );
      console.log(
        `test: byte errors = ${byteErrors} / ${expected.length} (${((byteErrors / expected.length) * 100).toFixed(2)}%)`,
      );

      const numBlocks = expected.length / 255;
      const blockErrors: number[] = [];
      for (let b = 0; b < numBlocks; b++) {
        let errs = 0;
        for (let j = 0; j < 255; j++) {
          const idx = b * 255 + j;
          if (expected[idx] !== decoded[idx]) errs++;
        }
        blockErrors.push(errs);
      }
      const maxBlockErrors = Math.max(...blockErrors);
      const overLimit = blockErrors.filter(e => e > 16).length;
      console.log(
        `test: RS blocks = ${numBlocks}, max byte errors in one block = ${maxBlockErrors} (limit 16), blocks over limit = ${overLimit}`,
      );
      if (overLimit > 0) {
        console.log(
          'test: blocks over RS limit:',
          blockErrors.map((e, i) => (e > 16 ? `${i}:${e}` : null)).filter(Boolean).join(', '),
        );
      }

      try {
        decodeErrorCorrection(decoded);
        console.log('test: RS decode on payload bytes only — OK');
      } catch (e) {
        console.log('test: RS decode on payload bytes only — FAIL:', (e as Error).message);
      }

      try {
        decodeErrorCorrection(fullDecoded);
        console.log('test: RS decode on full image extract — OK');
      } catch (e) {
        console.log('test: RS decode on full image extract — FAIL:', (e as Error).message);
      }
    } catch (e) {
      console.error('test failed:', e);
    } finally {
      setIsTesting(false);
    }
  }, [resultFile, encFile, cvLib.cv, w, h]);

  const progressTable = useMemo(() => {
    if (!progress) return null;
    const hasErrors = Object.values(progress).some(step => step.code === StepStatusCode.FAILED);
    return (
      <Flex direction={'column'} gap={'lg'} style={{padding: '0 5px', width: '350px'}}>
        <Flex direction={'column'}>
          {Object.keys(progress).map(key => {
            const step = progress[key];
            return (
              <Flex direction={'row'} key={key} gap={'xs'} justify={'space-between'}>
                <Flex direction={'row'} gap={'xs'} style={{ flexShrink: 1 }}>
                  {getStepIcon(step.code)}
                  <Flex direction={'column'} style={{ textAlign: 'left', flexShrink: 1 }}>
                    <Text style={{ color: stepTextColorMap[step.code] }}>{key}</Text>
                    {step.error && (
                      <Text style={{ color: 'red' }} size={'xs'}>
                        {step.error}
                      </Text>
                    )}
                  </Flex>
                </Flex>
                <Text style={{ color: 'darkgray', paddingTop: 2, flexShrink: 0 }} size={'sm'}>
                  {step.endTime && step.startTime ? step.endTime - step.startTime + ' ms' : ''}
                </Text>
              </Flex>
            );
          })}
        </Flex>
        <Flex direction={'column'} gap={'sm'}>
          {resultFileName}
          {resultFile && <Button onClick={download}>Download</Button>}
          {resultFile && encFile && (
            <Button onClick={test} disabled={isTesting}>
              Test
            </Button>
          )}
          {(resultFile || hasErrors) && <Button onClick={reset}>Reset</Button>}
        </Flex>
      </Flex>
    );
  }, [download, encFile, isTesting, progress, reset, resultFile, resultFileName, test]);

  return (
    <Flex direction={'row'} gap={120} justify={'center'} wrap={'wrap'}>
      {!progress && !cvLib.isLoading && (
        <Flex direction={'column'} gap={'sm'} style={{ alignItems: 'left', width: '200px', flexShrink: 0 }}>
          <Title size={'lg'}>Encode</Title>
          <NumberInput
            label={'width'}
            hideControls
            min={16}
            max={1080}
            value={w}
            onChange={onSetW}
            error={validateDimension(w)}
          />
          <NumberInput
            label={'height'}
            hideControls
            min={16}
            max={1080}
            value={h}
            onChange={onSetH}
            error={validateDimension(h)}
          />
          {details}
          {encFile?.name}
          <FileButton onChange={setEncFile}>{props => <Button {...props}>Choose file</Button>}</FileButton>
          <Button
            onClick={encode}
            disabled={
              !encFile ||
              validateDimension(w) != null ||
              validateDimension(h) != null ||
              approxEffectiveCapacityBytes <= 0
            }
          >
            Encode
          </Button>
        </Flex>
      )}

      {!progress && !cvLib.isLoading && (
        <Flex direction={'column'} gap={'sm'} style={{ alignItems: 'left', width: '200px', flexShrink: 0  }}>
          <Title size={'lg'}>Decode</Title>
          {decFile?.name}
          <FileButton onChange={setDecFile} accept="image/png,image/jpeg">
            {props => <Button {...props}>Choose image</Button>}
          </FileButton>
          <Button onClick={decode} disabled={!decFile}>
            Decode
          </Button>
        </Flex>
      )}

      {progress && progressTable}
    </Flex>
  );
}
