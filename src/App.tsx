import { useCallback, useRef, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { useOpenCV } from './hooks/opencv'
import { BitsIteratorImpl } from './processing/bits_iter'
import { EncoderImpl } from './processing/encoder'
import { DctConfs, DctConfsChroma, DefaultEncodingConf } from './processing/config'
import { displayImage } from './processing/image'
import { Button, Flex, Input, NumberInput, SegmentedControl, Textarea, TextInput, Title } from '@mantine/core'
import { Mat } from './components/mat/Mat'
import { DecoderImpl } from './processing/decoder'


function downloadMatAsJpeg(mat, filename = 'image.jpg') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = mat.cols;
    canvas.height = mat.rows;
    const imageData = ctx.createImageData(mat.cols, mat.rows);
    const matData = new Uint8ClampedArray(mat.data);
    const imageDataData = imageData.data;
    for (let i = 0, j = 0; i < matData.length; i += 3, j += 4) {
        imageDataData[j] = matData[i];     // R
        imageDataData[j + 1] = matData[i + 1]; // G
        imageDataData[j + 2] = matData[i + 2]; // B
        imageDataData[j + 3] = 255;        // A
    }
    ctx.putImageData(imageData, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

const INP_TYPE_TEXT = 'text';
const INP_TYPE_RANDOM = 'random';
const INP_TYPE_DECODE = 'decode';
const INP_TYPE_OPTIONS = [INP_TYPE_RANDOM, INP_TYPE_TEXT];


function App() {
  const [mat, setMat] = useState<any>(null)
  const [res, setRes] = useState<any>(null)
  const [randInputSize, setRandInputSize] = useState(96);
  const [inpType, setInpType] = useState(INP_TYPE_TEXT)
  const [inpText, setInpText] = useState("sample")
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    displayImage(res, canvasRef.current!);
    setMat(image);
    setRes(res);
  }, [cvLib, randInputSize, inpType, inpText])

  const decode = useCallback(() => {
    if (!res) return;
    const decoder = new DecoderImpl(cvLib.cv, DefaultEncodingConf)
    const bytes = decoder.decode(res);
    console.log('decoded:', bytes)
  }, [res])

  const download = useCallback(() => {
    if (!res) return;
    downloadMatAsJpeg(res);
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
        <canvas ref={canvasRef} width={240} height={240} onClick={download} style={{cursor: res ? 'pointer' : undefined }}></canvas>
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

export default App
