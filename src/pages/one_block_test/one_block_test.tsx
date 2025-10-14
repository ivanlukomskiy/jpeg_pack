import {useCallback, useMemo, useState} from 'react'
import {useOpenCV} from '../../hooks/opencv';
import {BitsIteratorImpl} from '../../processing/bits_iter';
import {DecoderImpl} from '../../processing/decoder';
import {DefaultEncodingConf} from '../../processing/config';
import {EncoderImpl} from '../../processing/encoder';
import {Button, Checkbox, Flex, NumberInput, Pill, SegmentedControl, Textarea, Title} from '@mantine/core';
import {MatRender} from '../../components/mat_render/MatRender';
import {Mat} from '../../components/mat/Mat';
import {jpegRoundTripBgr32f} from "../../processing/utils.ts";

const INP_TYPE_TEXT = 'text';
const INP_TYPE_RANDOM = 'random';
const INP_TYPE_BYTES = 'bytes';
const INP_TYPE_OPTIONS = [INP_TYPE_RANDOM, INP_TYPE_TEXT, INP_TYPE_BYTES];

const rand = () => Math.floor(Math.random() * 256);

function randomBytesString(n) {
    return Array.from({ length: n }, rand).join(', ');
}

function uint8ArrayToString(arr: Uint8Array): string {
    return Array.from(arr).join(", ");
}

function compareCommaSeparatedBytes(a: string, b: string): boolean {
    // Split by comma, trim spaces, filter out empties
    const arrA = a.split(",").map(s => s.trim()).filter(Boolean);
    const arrB = b.split(",").map(s => s.trim()).filter(Boolean);

    if (arrA.length !== arrB.length) return false;

    for (let i = 0; i < arrA.length; i++) {
        const numA = Number(arrA[i]);
        const numB = Number(arrB[i]);
        // Strict equality on numeric values
        if (!Number.isFinite(numA) || !Number.isFinite(numB) || numA !== numB) {
            return false;
        }
    }
    return true;
}

export function OneBlockTest() {
  const [mat, setMat] = useState<Record<string, any>>({})
    const [res, setRes] = useState<any>(null)
  const [randInputSize, setRandInputSize] = useState(96);
  // const [inpType, setInpType] = useState(INP_TYPE_BENCHMARK)
  const [inpType, setInpType] = useState(INP_TYPE_BYTES)
  const [inpText, setInpText] = useState("adcd")
  const [inpBytes, setInpBytes] = useState("86, 119, 123, 231")
  const [reencode, setReencode] = useState(true)
  const [decoded, setDecoded] = useState("");
  const cvLib = useOpenCV();

  const go = useCallback((bytes?: string) => {
    let iter = null;
    if (bytes || inpType == INP_TYPE_BYTES) {
        if (bytes) {
            console.log("bytes", bytes)
            iter = BitsIteratorImpl.fromBytes(new Uint8Array(bytes.split(",").map(Number)))
        } else {
            iter = BitsIteratorImpl.fromBytes(new Uint8Array(inpBytes.split(",").map(Number)))
        }
    } else if (inpType == INP_TYPE_TEXT) {
        const encoder = new TextEncoder();
        const data = encoder.encode(inpText);
        console.log("data", data)
      iter = BitsIteratorImpl.fromText(inpText);
    } else {
      iter = BitsIteratorImpl.random(randInputSize);
    }
    const encoder = new EncoderImpl(cvLib.cv, 16, 16, iter, DefaultEncodingConf)
    const res = encoder.encode();
    // setRes(res.clone());

    // setMat({
    //     // prime: encoder.prime,
    //     dataMatrix: encoder.dataMatrix.clone(),
    //     ycrcb: encoder.ycrcb.clone(),
    //     transformed: encoder.transformed.clone(),
    //     bgr32f: encoder.bgr32f.clone(),
    //     res: res.clone(),
    // })
    //   return res.clone();
  }, [cvLib, randInputSize, inpType, inpText, inpBytes])
  
  const decode = useCallback(async (res: any) => {
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
    setDecoded(uint8ArrayToString(bytes))
  }, [cvLib.cv, reencode])

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

  const randomize = useCallback(() => {
      const val = randomBytesString(16);
      setInpBytes(val);
      return val;
  }, [])

    const match = useMemo(() => {
        if (decoded == "") return null;
        return compareCommaSeparatedBytes(inpBytes, decoded);
    }, [inpBytes, decoded])

    const randomizeAndCheck = useCallback(async () => {
        setDecoded("")
        const val = randomize()
        const res= go(val)
        await decode(res);
    }, [decode, go, randomize])

  return (
    <Flex direction={'column'} gap={'xl'}>
    <Flex direction={'row'} gap={'xl'}>
      <Flex direction={'column'} gap={'sm'} style={{alignItems: 'left', width: '200px'}}>
        <Title size={'lg'}>Input</Title>
        <SegmentedControl color="blue" data={INP_TYPE_OPTIONS} value={inpType} onChange={setInpType} />
        {inpType == INP_TYPE_TEXT && <Textarea autosize label="Text" value={inpText} onChange={onSetInpText} />}
        {inpType == INP_TYPE_BYTES && <Textarea autosize label="Bytes" value={inpBytes} onChange={onSetInpBytes} />}
        {inpType == INP_TYPE_RANDOM && <NumberInput label="Size" min={0} hideControls value={randInputSize} onChange={onRandInputSizeChanged}/>}
          {inpType == INP_TYPE_BYTES && <Button onClick={randomize}>Randomize</Button>}
        <Checkbox label={'reencode'} checked={reencode} onClick={() => setReencode(r => !r)} />
          <Button onClick={() => go()}>
          Generate
        </Button>
          <Button onClick={randomizeAndCheck}>
              Randomize & check
        </Button>
      </Flex>
      <Flex direction={'column'} gap={'sm'}>
        <Title size={'lg'}>Result</Title>
        <MatRender mat={res} />
        {res && <Button onClick={() => decode(res)}>
          Decode
        </Button>}
      </Flex>
      <Flex direction={'column'} gap={'sm'}>
        <Title size={'lg'}>Decoded</Title>
          {decoded}
          {match !== null && <Pill style={{backgroundColor: match ? 'lightgreen' : 'red'}}>
              {compareCommaSeparatedBytes(inpBytes, decoded) ? 'Match' : 'Mismatch'}
          </Pill>}
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
