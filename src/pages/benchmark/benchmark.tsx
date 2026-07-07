import { Button, Flex, NumberInput, Progress, Title, Typography } from '@mantine/core';
import { MatRender } from '../../components/mat_render/MatRender';
import { BenchmarkEncodingConf } from '../../processing/config';
import {
  BitsIteratorImpl,
  buildErrSourceAcc,
  calculateErrorSources,
  compareBits,
  compareBytes,
  randomBytesForBitLength,
} from '../../processing/bits_iter';
import { EncoderImpl } from '../../processing/encoder';
import { DecoderImpl } from '../../processing/decoder';
import { useCallback, useMemo, useState } from 'react';
import { useOpenCV } from '../../hooks/opencv';
import { BarChart } from '@mantine/charts';
import { jpegRoundTripBgr32f } from '../../processing/utils.ts';
import { buildDctConfStats, countTotalBits, normalizeErrorSources } from '../../processing/blocks_iterator.ts';
import { ErrTable } from '../../components/err_table/ErrTable.tsx';
import { analyzeF32Matrix, type ChannelStats } from '../../processing/matrix_analysis.ts';
import { MatChart } from '../../components/mat_chart/MatChart.tsx';

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

const percentilePoints = [10, 30, 50, 70, 90];
interface PercentilePoint {
  value: number;
  percentile: string;
}

export function Benchmark() {
  const [res, setRes] = useState<any>(null);
  const [iterations, setIterations] = useState(20);
  const [jpegQuality, setJpegQuality] = useState(0.95);
  const [blocksPerAxis, setBlocksPerAxis] = useState(4);
  const [progress, setProgress] = useState<number | null>(null);
  const cvLib = useOpenCV();
  const [bitErrRates, setBitErrRate] = useState<number[] | null>(null);
  const [byteErrRates, setByteErrRate] = useState<number[] | null>(null);
  const [errByDctPos, setErrByDctPos] = useState<Record<string, number> | null>(null);
  const [ycrcbStats, setYCrCbStats] = useState<Record<string, ChannelStats> | null>(null);
  const [rgbStats, setRgbStats] = useState<Record<string, ChannelStats> | null>(null);

  const benchmark = useCallback(async () => {
    try {
      const stats = buildDctConfStats(BenchmarkEncodingConf);
      const width = 8 * blocksPerAxis;
      const height = 8 * blocksPerAxis;
      const sizeBits = countTotalBits(width, height, BenchmarkEncodingConf);
      const ycrcbStats: Record<string, ChannelStats> = {};
      const rgbStats: Record<string, ChannelStats> = {};

      const bitRates = [];
      const byteRates = [];
      setBitErrRate([]);
      setProgress(0);
      const acc = buildErrSourceAcc(stats);
      for (let i = 0; i < iterations; i++) {
        const original = randomBytesForBitLength(sizeBits);
        const iter = BitsIteratorImpl.fromBytes(original, sizeBits);
        const encoder = new EncoderImpl(cvLib.cv, width, height, iter, BenchmarkEncodingConf);
        const res = encoder.encode(true);
        analyzeF32Matrix(ycrcbStats, encoder.transformed, true);
        analyzeF32Matrix(rgbStats, encoder.bgr32f, false);

        const { bgr32fDecoded } = await jpegRoundTripBgr32f(cvLib.cv, res, jpegQuality);

        const decoder = new DecoderImpl(cvLib.cv, BenchmarkEncodingConf);
        const decoded = decoder.decode(bgr32fDecoded, true);
        setRes(res);
        console.log('original', original);
        console.log('decoded', decoded);
        const bitErrorsCount = compareBits(original, decoded);
        const byteErrorsCount = compareBytes(original, decoded);
        calculateErrorSources(original, decoded, acc, stats);
        bitRates.push(bitErrorsCount / sizeBits);
        byteRates.push(byteErrorsCount / original.length);
        setBitErrRate([...bitRates]);
        setByteErrRate([...byteRates]);
        setProgress((i + 1) / iterations);
      }
      const normalized = normalizeErrorSources(
        acc,
        stats,
        width,
        height,
        iterations,
        BenchmarkEncodingConf,
      );
      setErrByDctPos(normalized);
      setProgress(null);
      setRgbStats(rgbStats);
      setYCrCbStats(ycrcbStats);
    } catch (e) {
      console.error(e);
      setProgress(null);
      return null;
    }
  }, [cvLib, jpegQuality, iterations, blocksPerAxis]);

  const bitPercentiles = useMemo(() => {
    if (!bitErrRates || bitErrRates.length == 0) return null;
    const sorted = [...bitErrRates].sort((a, b) => a - b);
    const res: PercentilePoint[] = [];
    percentilePoints.forEach(p => {
      res.push({
        value: getPercentile(sorted, p) * 100,
        percentile: `p${p}`,
      });
    });
    return res;
  }, [bitErrRates]);

  const bytePercentiles = useMemo(() => {
    if (!byteErrRates || byteErrRates.length == 0) return null;
    const sorted = [...byteErrRates].sort((a, b) => a - b);
    const res: PercentilePoint[] = [];
    percentilePoints.forEach(p => {
      res.push({
        value: getPercentile(sorted, p) * 100,
        percentile: `p${p}`,
      });
    });
    return res;
  }, [byteErrRates]);

  const onIterationsChanged = useCallback((e: number | string) => {
    setIterations(e as number);
  }, []);

  const onJpegQualityChanged = useCallback((e: number | string) => {
    setJpegQuality(e as number);
  }, []);

  const onBlockPerAxisChanged = useCallback((e: number | string) => {
    setBlocksPerAxis(e as number);
  }, []);

  return (
    <Flex direction={'row'} gap={'xl'} style={{ width: '100%' }}>
      <Flex direction={'column'} gap={'sm'} style={{ alignItems: 'left', width: '200px', flexGrow: 0 }}>
        <Title size={'lg'}>Settings</Title>
        <NumberInput label="iterations" value={iterations} min={0} onChange={onIterationsChanged} hideControls />
        <NumberInput
          label="jpeg quality"
          value={jpegQuality}
          min={0}
          max={100}
          onChange={onJpegQualityChanged}
          hideControls
        />
        <NumberInput
          label="blocks per axis"
          value={blocksPerAxis}
          min={1}
          onChange={onBlockPerAxisChanged}
          hideControls
        />
        <Button onClick={benchmark}>Start</Button>
      </Flex>
      <Flex direction={'column'} gap={'sm'} style={{ flexGrow: 0 }}>
        <Title size={'lg'}>Image</Title>
        <MatRender mat={res} />
        {progress && <Progress value={progress * 100}></Progress>}
        {errByDctPos && <Typography>Err chance per bit</Typography>}
        {errByDctPos && <ErrTable errByName={errByDctPos} />}
      </Flex>
      <Flex direction={'column'} gap={'sm'} style={{ flexGrow: 1 }}>
        <Title size={'lg'}>Stats</Title>
        {/* {medianErrorRate !== null && <Typography >Errors rate median: {(medianErrorRate*100.).toFixed(2)}%</Typography>} */}
        <Flex direction={'row'} gap={'xl'}>
          {bitPercentiles && (
            <Flex direction={'column'}>
              <Typography>Bit err rate, % by percentiles</Typography>
              <BarChart
                h={200}
                w={300}
                data={bitPercentiles}
                dataKey="percentile"
                series={[{ name: 'value', color: 'violet.6' }]}
                tickLine="y"
              />
            </Flex>
          )}
          {bytePercentiles && (
            <Flex direction={'column'}>
              <Typography>Byte err rate, % by percentiles</Typography>
              <BarChart
                h={200}
                w={300}
                data={bytePercentiles}
                dataKey="percentile"
                series={[{ name: 'value', color: 'violet.6' }]}
                tickLine="y"
              />
            </Flex>
          )}
        </Flex>
        {ycrcbStats && <MatChart chStats={ycrcbStats} />}
        {rgbStats && <MatChart chStats={rgbStats} />}
      </Flex>
    </Flex>
  );
}
