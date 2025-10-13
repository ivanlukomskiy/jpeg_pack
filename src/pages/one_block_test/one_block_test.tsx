import { useCallback, useRef, useState } from 'react'
import { useOpenCV } from '../../hooks/opencv';
import { BitsIteratorImpl } from '../../processing/bits_iter';
import { DecoderImpl } from '../../processing/decoder';
import { DefaultEncodingConf } from '../../processing/config';
import { EncoderImpl } from '../../processing/encoder';
import {Button, Checkbox, Flex, NumberInput, SegmentedControl, Textarea, Title} from '@mantine/core';
import { MatRender } from '../../components/mat_render/MatRender';
import { Mat } from '../../components/mat/Mat';
import {jpegRoundTripBgr32f} from "../../processing/utils.ts";

const INP_TYPE_TEXT = 'text';
const INP_TYPE_RANDOM = 'random';
const INP_TYPE_BYTES = 'bytes';
const INP_TYPE_OPTIONS = [INP_TYPE_RANDOM, INP_TYPE_TEXT, INP_TYPE_BYTES];


export function OneBlockTest() {
  const [mat, setMat] = useState<Record<string, any>>({})
    const [res, setRes] = useState<any>(null)
  const [randInputSize, setRandInputSize] = useState(96);
  // const [inpType, setInpType] = useState(INP_TYPE_BENCHMARK)
  const [inpType, setInpType] = useState(INP_TYPE_BYTES)
  const [inpText, setInpText] = useState("adcd")
  const [inpBytes, setInpBytes] = useState("86, 119, 123, 231")
  const [reencode, setReencode] = useState(true)
  // const [errRateData, setErrRateData] = useState(null);
  const cvLib = useOpenCV();

  const go = useCallback(() => {
    let iter = null;
    if (inpType == INP_TYPE_TEXT) {
        const encoder = new TextEncoder();
        const data = encoder.encode(inpText);
        console.log("data", data)
      iter = BitsIteratorImpl.fromText(inpText);
    } else if(inpType == INP_TYPE_RANDOM) {
      iter = BitsIteratorImpl.random(randInputSize);
    } else {
        iter = BitsIteratorImpl.fromBytes(new Uint8Array(inpBytes.split(",").map(Number)))
    }
    const encoder = new EncoderImpl(cvLib.cv, 8, 8, iter, DefaultEncodingConf)
    const res = encoder.encode();
    setRes(res);

    setMat({
        // prime: encoder.prime,
        dataMatrix: encoder.dataMatrix,
        ycrcb: encoder.ycrcb,
        transformed: encoder.transformed,
        bgr32f: encoder.bgr32f,
        res,
    })
  }, [cvLib, randInputSize, inpType, inpText, inpBytes])
  
  const decode = useCallback(async () => {
    if (!res) return;
    let source = res;
    if (reencode) {
        const reencoded = await jpegRoundTripBgr32f(cvLib.cv, source)
        source = reencoded.bgr32fDecoded;
    }
    const decoder = new DecoderImpl(cvLib.cv, DefaultEncodingConf)
    const bytes = decoder.decode(source);
    setMat({
        dataMatrix: decoder.dataMatrix,
        transformed: decoder.transformed,
        bgr32f: decoder.bgr32f,
        ycrcb: decoder.ycrcb,
    })
    console.log('decoded:', bytes)
  }, [cvLib.cv, reencode, res])

  const onRandInputSizeChanged = useCallback((e) => {
    setRandInputSize(e);
  }, []);

  const onSetInpText = useCallback((e) => {
    console.log(e.target.value);
    setInpText(e.target.value);
  }, []);

  const onSetInpBytes = useCallback((e) => {
    console.log(e.target.value);
    setInpBytes(e.target.value);
  }, []);

  return (
    <Flex direction={'column'} gap={'xl'}>
    <Flex direction={'row'} gap={'xl'}>
      <Flex direction={'column'} gap={'sm'} style={{alignItems: 'left', width: '200px'}}>
        <Title size={'lg'}>Input</Title>
        <SegmentedControl color="blue" data={INP_TYPE_OPTIONS} value={inpType} onChange={setInpType} />
        {inpType == INP_TYPE_TEXT && <Textarea autosize label="Text" value={inpText} onChange={onSetInpText} />}
        {inpType == INP_TYPE_BYTES && <Textarea autosize label="Bytes" value={inpBytes} onChange={onSetInpBytes} />}
        {inpType == INP_TYPE_RANDOM && <NumberInput label="Size" min={0} hideControls value={randInputSize} onChange={onRandInputSizeChanged}/>}
        <Checkbox label={'reencode'} checked={reencode} onClick={() => setReencode(r => !r)} />
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
        {Object.keys(mat).map(key => {
            return (
                <span key={key}>
                    <Title>{key}</Title>
                    <Mat mat={mat[key]} />
                </span>
            )
        })}
    </Flex>
    </Flex>
  )
}
