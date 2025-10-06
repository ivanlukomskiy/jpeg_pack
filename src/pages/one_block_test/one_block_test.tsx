import { useCallback, useRef, useState } from 'react'
import { useOpenCV } from '../../hooks/opencv';
import { BitsIteratorImpl } from '../../processing/bits_iter';
import { DecoderImpl } from '../../processing/decoder';
import { DefaultEncodingConf } from '../../processing/config';
import { EncoderImpl } from '../../processing/encoder';
import { Button, Flex, NumberInput, SegmentedControl, Textarea, Title } from '@mantine/core';
import { MatRender } from '../../components/mat_render/MatRender';
import { Mat } from '../../components/mat/Mat';

const INP_TYPE_TEXT = 'text';
const INP_TYPE_RANDOM = 'random';
const INP_TYPE_BENCHMARK = 'bench';
const INP_TYPE_OPTIONS = [INP_TYPE_RANDOM, INP_TYPE_TEXT];


export function OneBlockTest() {
  const [mat, setMat] = useState<any>(null)
  const [res, setRes] = useState<any>(null)
  const [randInputSize, setRandInputSize] = useState(96);
  // const [inpType, setInpType] = useState(INP_TYPE_BENCHMARK)
  const [inpType, setInpType] = useState(INP_TYPE_TEXT)
  const [inpText, setInpText] = useState("adc")
  // const [errRateData, setErrRateData] = useState(null);
  const cvLib = useOpenCV();

  const go = useCallback(() => {
    let iter = null;
    if (inpType == INP_TYPE_TEXT) {
      iter = BitsIteratorImpl.fromText(inpText);
    } else {
      iter = BitsIteratorImpl.random(randInputSize);
    }
    const encoder = new EncoderImpl(cvLib.cv, 8, 8, iter, DefaultEncodingConf)
    const [image, res] = encoder.encode();
    setMat(image);
    setRes(res);
  }, [cvLib, randInputSize, inpType, inpText])
  
  const decode = useCallback(() => {
    if (!res) return;
    const decoder = new DecoderImpl(cvLib.cv, DefaultEncodingConf)
    const bytes = decoder.decode(res);
    console.log('decoded:', bytes)
  }, [res])

  const onRandInputSizeChanged = useCallback((e) => {
    setRandInputSize(e);
  }, []);

  const onSetInpText = useCallback((e) => {
    console.log(e.target.value);
    setInpText(e.target.value);
  }, []);

  return (
    <Flex direction={'column'} gap={'xl'}>
    <Flex direction={'row'} gap={'xl'}>
      <Flex direction={'column'} gap={'sm'} style={{alignItems: 'left', width: '200px'}}>
        <Title size={'lg'}>Input</Title>
        <SegmentedControl color="blue" data={INP_TYPE_OPTIONS} value={inpType} onChange={setInpType} />
        {inpType == INP_TYPE_TEXT && <Textarea autosize label="Text" value={inpText} onChange={onSetInpText} />}
        {inpType == INP_TYPE_RANDOM && <NumberInput label="Size" min={0} hideControls value={randInputSize} onChange={onRandInputSizeChanged}/>}
        <Button onClick={go}>
          Generate
        </Button>
      </Flex>
      <Flex direction={'column'} gap={'sm'}>
        <Title size={'lg'}>Result</Title>
        <MatRender mat={res} />
        {res && <Button onClick={decode}>
          Decode
        </Button>}
      </Flex>
      <Flex direction={'column'} gap={'sm'}>
        <Title size={'lg'}>Decoded</Title>
        
      </Flex>
    </Flex>
    <Flex direction={'column'} gap={'xl'}>
      <Title>YCrCb</Title>
      <Mat mat={mat} />
      <Title>BGR</Title>
      <Mat mat={res} />
    </Flex>
    </Flex>
  )
}
