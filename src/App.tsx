import { useCallback, useRef, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { useOpenCV } from './hooks/opencv'
import { BitsIteratorImpl } from './processing/bits_iter'
import { EncoderImpl } from './processing/encoder'
import { DctConfs, DctConfsChroma } from './processing/config'
import { displayImage } from './processing/image'
import { Button, Flex, Title } from '@mantine/core'
import { Mat } from './components/mat/Mat'



function App() {
  const [mat, setMat] = useState<any>(null)
  const [res, setRes] = useState<any>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cvLib = useOpenCV();

  const go = useCallback(() => {
    const iter = BitsIteratorImpl.random(32*3);
    const encoder = new EncoderImpl(cvLib.cv, 16, 16, iter, DctConfsChroma, DctConfs)
    const [image, res] = encoder.encode();
    displayImage(res, canvasRef.current!);
    setMat(image);
    setRes(res)

  }, [cvLib])

  return (
    <>
      <Flex direction={'column'} gap={'sm'} style={{alignItems: 'center'}}>
        <Button onClick={go}>
          Generate
        </Button>
        <canvas ref={canvasRef} width={240} height={240}></canvas>
        <Title>YCrCb</Title>
        <Mat mat={mat} />
        <Title>BGR</Title>
        <Mat mat={res} />
      </Flex>
    </>
  )
}

export default App
