import { Button, Flex, NumberInput, SegmentedControl, Textarea, Title, Typography } from "@mantine/core";
import { MatRender } from "../../components/mat_render/MatRender";
import { DefaultEncodingConf } from "../../processing/config";
import { BitsIteratorImpl, compareBits, randomUint8Arr } from "../../processing/bits_iter";
import { EncoderImpl } from "../../processing/encoder";
import { DecoderImpl } from "../../processing/decoder";
import { useCallback, useMemo, useState } from "react";
import { useOpenCV } from "../../hooks/opencv";
import { sampleText } from "../../processing/sample_text";

export function EncodeText() {
    const [res, setRes] = useState<any>(null)
    const cvLib = useOpenCV();
    const [w, setW] = useState(320);
    const [h, setH] = useState(320);
    const [inpText, setInpText] = useState(sampleText)

    const bytesPerBlock = useMemo(() => {
        let size = 0;
        DefaultEncodingConf.chromaConf.forEach(c => {
          size += c.bitsCapacity * 2;
        })
        DefaultEncodingConf.lumaConf.forEach(c => {
          size += c.bitsCapacity;
        })
        return size / 8;
    }, [])

    const encode = useCallback(async () => {
        const blocksSide = 8;
        let size = 0;
        DefaultEncodingConf.chromaConf.forEach(c => {
          size += c.bitsCapacity * 2;
        })
        DefaultEncodingConf.lumaConf.forEach(c => {
          size += c.bitsCapacity;
        })
        size *= blocksSide * blocksSide;
    
        const iter = BitsIteratorImpl.fromText(inpText);
        const encoder = new EncoderImpl(cvLib.cv, w, h, iter, DefaultEncodingConf)
        const [image, res] = encoder.encode();
    
        //   let {rgb8Decoded} = await jpegRoundTrip(cvLib.cv, res, 95);
        //   console.log('rgb8Decoded', rgb8Decoded)
    
        //   const decoder = new DecoderImpl(cvLib.cv, DefaultEncodingConf)
        //   const decoded = decoder.decode(rgb8Decoded);
          setRes(res);
     
        // console.log('median errors fraction', getMedian(rates))
      }, [cvLib, res, inpText, w, h])

    const onSetW = useCallback((e) => {
        setW(e);
    }, []);
    const onSetH = useCallback((e) => {
        setH(e);
    }, []);

    const onSetInpText = useCallback((e) => {
        setInpText(e.target.value);
    }, []);

    const capacityBytes = useMemo(() => {
        return w / 8 * h / 8 * bytesPerBlock;
    }, [w, h])

    const usedBytes = useMemo(() => {
        const encoder = new TextEncoder();
        const data = encoder.encode(inpText);
        return data.length;
    }, [inpText])
    
      return (
        <Flex direction={'row'} gap={'xl'}>
          <Flex direction={'column'} gap={'sm'} style={{alignItems: 'left', width: '200px'}}>
            <Title size={'lg'}>Settings</Title>
            <Textarea label="text" value={inpText} onChange={onSetInpText} />
            {/* <Textarea autosize label="text" value={inpText} onChange={onSetInpText} /> */}
            <NumberInput label={'width'} hideControls min={8} max={1080} value={w} onChange={onSetW} />
            <NumberInput label={'height'} hideControls min={8} max={1080} value={h} onChange={onSetH} />
            <Button onClick={encode}>
              Encode
            </Button>
          </Flex>
          <Flex direction={'column'} gap={'sm'}>
            <Title size={'lg'}>Result</Title>
            <MatRender mat={res} />
          </Flex>
          <Flex direction={'column'} gap={'sm'}>
            <Title size={'lg'}>Details</Title>
            <Typography>Capacity: {(capacityBytes / 1024).toFixed(2)} KB</Typography>
            <Typography>Used: {(usedBytes / 1024).toFixed(2)} KB</Typography>
            <Typography>Bytes per block: {bytesPerBlock}</Typography>
          </Flex>
        </Flex>
      )
}
