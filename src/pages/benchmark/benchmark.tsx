import { Button, Flex, NumberInput, SegmentedControl, Title, Typography } from "@mantine/core";
import { MatRender } from "../../components/mat_render/MatRender";
import { DefaultEncodingConf } from "../../processing/config";
import { BitsIteratorImpl, buildErrSourceAcc, calculateErrorSources, compareBits, compareBytes, normalizeErrorSources, randomUint8Arr } from "../../processing/bits_iter";
import { EncoderImpl } from "../../processing/encoder";
import { DecoderImpl } from "../../processing/decoder";
import { useCallback, useMemo, useState } from "react";
import { useOpenCV } from "../../hooks/opencv";
import { BarChart } from "@mantine/charts";

async function jpegRoundTripBgr32f(cv, bgr32f, quality = 0.95, unitRange = true) {
    // --- ENCODE ---
    // 1) Convert 32F -> 8U (and scale if needed)
    const bgr8 = new cv.Mat();
    const encScale = unitRange ? 255.0 : 1.0;
    bgr32f.convertTo(bgr8, cv.CV_8UC3, encScale);

    // 2) BGR -> RGBA (canvas expects RGBA)
    const rgba = new cv.Mat();
    cv.cvtColor(bgr8, rgba, cv.COLOR_BGR2RGBA);
    bgr8.delete();

    // 3) Draw to canvas & encode to JPEG
    const encCanvas = document.createElement('canvas');
    encCanvas.width = rgba.cols;
    encCanvas.height = rgba.rows;
    cv.imshow(encCanvas, rgba);
    rgba.delete();

    const blob = await new Promise(res => encCanvas.toBlob(res, 'image/jpeg', quality));

    // --- DECODE ---
    // 4) Decode JPEG with <img>, draw back to a canvas
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

    // 5) Read pixels into RGBA Mat
    const imageData = dctx.getImageData(0, 0, decCanvas.width, decCanvas.height);
    const rgbaDec = cv.matFromImageData(imageData);

    // 6) RGBA -> BGR 8U
    const bgr8Decoded = new cv.Mat();
    cv.cvtColor(rgbaDec, bgr8Decoded, cv.COLOR_RGBA2BGR);
    rgbaDec.delete();

    // 7) 8U -> 32F (and scale back if we scaled on encode)
    const bgr32fDecoded = new cv.Mat();
    const decScale = unitRange ? (1.0 / 255.0) : 1.0;
    bgr8Decoded.convertTo(bgr32fDecoded, cv.CV_32FC3, decScale);
    bgr8Decoded.delete();

    return { bgr32fDecoded, blob };
}

function getPercentile(sortedNumbers: number[], percentile: number) {
    const index = (percentile / 100) * (sortedNumbers.length - 1);
    if (Number.isInteger(index)) {
        return sortedNumbers[index];
    }
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    const weight = index - lowerIndex;
    return sortedNumbers[lowerIndex] + weight * (sortedNumbers[upperIndex] - sortedNumbers[lowerIndex]);
}

const percentilePoints = [10, 30, 50, 70, 90]
interface PercentilePoint {
    value: number;
    percentile: string;
}

export function Benchmark() {
    const [res, setRes] = useState<any>(null)
    const [iterations, setIterations] = useState(1);
    const [jpegQuality, setJpegQuality] = useState(95);
    const [blocksPerAxis, setBlocksPerAxis] = useState(8);
    const [progress, setProgress] = useState<number | null>(null);
    const cvLib = useOpenCV();
    const [bitErrRates, setBitErrRate] = useState<number[] | null>(null);
    const [byteErrRates, setByteErrRate] = useState<number[] | null>(null);
    const [errByDctPos, setErrByDctPos] = useState<Record<string, number> | null>(null);

    const benchmark = useCallback(async () => {
        let size = 0;
        DefaultEncodingConf.chromaConf.forEach(c => {
          size += c.bitsCapacity * 2;
        })
        DefaultEncodingConf.lumaConf.forEach(c => {
          size += c.bitsCapacity;
        })
        size *= blocksPerAxis * blocksPerAxis;
    
        const bitRates = [];
        const byteRates = [];
        setBitErrRate([]);
        setProgress(0.);
        const acc = buildErrSourceAcc();
        for (let i = 0; i < iterations; i ++) {
          const original = randomUint8Arr(size);
          const iter = BitsIteratorImpl.fromBytes(original);
          const encoder = new EncoderImpl(cvLib.cv, 8 * blocksPerAxis, 8 * blocksPerAxis, iter, DefaultEncodingConf)
          const res = encoder.encode();
    
          const {bgr32fDecoded} = await jpegRoundTripBgr32f(cvLib.cv, res, jpegQuality);
    
          const decoder = new DecoderImpl(cvLib.cv, DefaultEncodingConf)
          const decoded = decoder.decode(bgr32fDecoded);
          setRes(res);
          console.log("original", original)
          console.log("decoded", decoded)
          const bitErrorsCount = compareBits(original, decoded)
          const byteErrorsCount = compareBytes(original, decoded)
          calculateErrorSources(original, decoded, acc);
          bitRates.push(bitErrorsCount / size)
          byteRates.push(byteErrorsCount / original.length)
          setBitErrRate([...bitRates])
          setByteErrRate([...byteRates])
          setProgress((i + 1) / iterations);
        }
        normalizeErrorSources(acc);
        setErrByDctPos(acc); // fixme looks like it gets calculated wrong, need to inverse-test it
        console.log('acc', acc)
        setProgress(null);
      }, [cvLib, res, jpegQuality, iterations, blocksPerAxis])

      const bitPercentiles = useMemo(() => {
        if (!bitErrRates || bitErrRates.length == 0) return null;
        const sorted = [...bitErrRates].sort((a, b) => a - b);
        const res: PercentilePoint[] = [];
        percentilePoints.forEach(p => {
            res.push({
                value: getPercentile(sorted, p) * 100,
                percentile: `p${p}`,
            })
        })
        return res;
      }, [bitErrRates])

      const bytePercentiles = useMemo(() => {
        if (!byteErrRates || byteErrRates.length == 0) return null;
        const sorted = [...byteErrRates].sort((a, b) => a - b);
        const res: PercentilePoint[] = [];
        percentilePoints.forEach(p => {
            res.push({
                value: getPercentile(sorted, p) * 100,
                percentile: `p${p}`,
            })
        })
        return res;
      }, [byteErrRates])

  const onIterationsChanged = useCallback((e) => {
    setIterations(e);
  }, []);

  const onJpegQualityChanged = useCallback((e) => {
    setJpegQuality(e);
  }, []);

  const onBlockPerAxisChanged = useCallback((e) => {
    setBlocksPerAxis(e);
  }, []);
    
      return (
        <Flex direction={'row'} gap={'xl'}>
          <Flex direction={'column'} gap={'sm'} style={{alignItems: 'left', width: '200px'}}>
            <Title size={'lg'}>Settings</Title>
            <NumberInput label="iterations" value={iterations} min={0} onChange={onIterationsChanged} hideControls />
            <NumberInput label="jpeg quality" value={jpegQuality} min={0} max={100} onChange={onJpegQualityChanged} hideControls />
            <NumberInput label="blocks per axis" value={blocksPerAxis} min={1} onChange={onBlockPerAxisChanged} hideControls />
            <Button onClick={benchmark}>
              Start
            </Button>
          </Flex>
          <Flex direction={'column'} gap={'sm'}>
            <Title size={'lg'}>Image</Title>
            <MatRender mat={res} />
            
          </Flex>
          <Flex direction={'column'} gap={'sm'} style={{width: '300px'}}>
            <Title size={'lg'}>Stats</Title>
            {/* {medianErrorRate !== null && <Typography >Errors rate median: {(medianErrorRate*100.).toFixed(2)}%</Typography>} */}
            
            {bitPercentiles && <>
                <Typography>Bit err rate, % by percentiles</Typography>
                <BarChart
                    h={200}
                    data={bitPercentiles}
                    dataKey="percentile"
                    series={[
                        { name: 'value', color: 'violet.6' },
                    ]}
                    tickLine="y"
                />
            </>}
            {bytePercentiles && <>
                <Typography>Byte err rate, % by percentiles</Typography>
                <BarChart
                    h={200}
                    data={bytePercentiles}
                    dataKey="percentile"
                    series={[
                        { name: 'value', color: 'violet.6' },
                    ]}
                    tickLine="y"
                />
            </>}

            {errByDctPos && Object.keys(errByDctPos).map((key) => 
               ( <Typography key={key}>{key}: {(errByDctPos[key] * 100).toFixed(2)}%</Typography>)
            )}
        </Flex>
        </Flex>
      )
}
