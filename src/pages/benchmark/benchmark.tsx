import { Button, Flex, SegmentedControl, Title } from "@mantine/core";
import { MatRender } from "../../components/mat_render/MatRender";
import { DefaultEncodingConf } from "../../processing/config";
import { BitsIteratorImpl, compareBits, randomUint8Arr } from "../../processing/bits_iter";
import { EncoderImpl } from "../../processing/encoder";
import { DecoderImpl } from "../../processing/decoder";
import { useCallback, useState } from "react";
import { useOpenCV } from "../../hooks/opencv";

// rgb8: CV_8UC3 (RGB), range 0..255
async function jpegRoundTrip(cv, rgb8, quality = 0.95) {
  // --- ENCODE via Canvas ---
  // 1) RGB -> RGBA (for canvas)
  let rgba = new cv.Mat();
  cv.cvtColor(rgb8, rgba, cv.COLOR_RGB2RGBA);

  // 2) Draw to a canvas
  const encCanvas = document.createElement('canvas');
  encCanvas.width = rgba.cols;
  encCanvas.height = rgba.rows;
  cv.imshow(encCanvas, rgba);
  rgba.delete();

  // 3) Encode to JPEG using browser encoder
  const blob = await new Promise(res => encCanvas.toBlob(res, 'image/jpeg', quality));

  // --- DECODE via Canvas/ImageData ---
  // 4) Decode blob to an <img> and draw it
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

  // 5) Read pixels back to Mat (RGBA) without cv.imread
  const imageData = dctx.getImageData(0, 0, decCanvas.width, decCanvas.height);
  let rgbaDec = cv.matFromImageData(imageData);

  // 6) RGBA -> RGB Mat
  let rgb8Decoded = new cv.Mat();
  cv.cvtColor(rgbaDec, rgb8Decoded, cv.COLOR_RGBA2RGB);
  rgbaDec.delete();

  return { rgb8Decoded, blob };
}

function getMedian(numbers: number[]) {
    if (!numbers.length) return null;
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) {
        return sorted[middle];
    }
    return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function Benchmark() {
    const [res, setRes] = useState<any>(null)
    const cvLib = useOpenCV();

    const benchmark = useCallback(async () => {
        const blocksSide = 8;
        let size = 0;
        DefaultEncodingConf.chromaConf.forEach(c => {
          size += c.bitsCapacity * 2;
        })
        DefaultEncodingConf.lumaConf.forEach(c => {
          size += c.bitsCapacity;
        })
        size *= blocksSide * blocksSide;
    
        const rates = [];
        for (let i = 0; i < 500; i ++) {
          const original = randomUint8Arr(size);
          const iter = BitsIteratorImpl.fromBytes(original);
          const encoder = new EncoderImpl(cvLib.cv, 8 * blocksSide, 8 * blocksSide, iter, DefaultEncodingConf)
          const [image, res] = encoder.encode();
    
          let {rgb8Decoded} = await jpegRoundTrip(cvLib.cv, res, 95);
          console.log('rgb8Decoded', rgb8Decoded)
    
          const decoder = new DecoderImpl(cvLib.cv, DefaultEncodingConf)
          const decoded = decoder.decode(rgb8Decoded);
          setRes(res);
          const errorsCount = compareBits(original, decoded)
          console.log('err', errorsCount)
          rates.push(errorsCount / size)
        }
        console.log('median errors fraction', getMedian(rates))
      }, [cvLib, res])
    
      return (
        <Flex direction={'row'} gap={'xl'}>
          <Flex direction={'column'} gap={'sm'} style={{alignItems: 'left', width: '200px'}}>
            <Title size={'lg'}>Settings</Title>
            <Button onClick={benchmark}>
              Start
            </Button>
          </Flex>
          <Flex direction={'column'} gap={'sm'}>
            <Title size={'lg'}>Result</Title>
            <MatRender mat={res} />
          </Flex>
          <Flex direction={'column'} gap={'sm'}>
            <Title size={'lg'}>Decoded</Title>
            
          </Flex>
        </Flex>
      )
}
