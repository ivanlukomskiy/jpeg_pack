

// 1. 4 bytes: error correction bits number
// 2. 4 more bytes: error correction for (1)
// 3. type: 0 - text; 1 - file
// 4. if type==1, filename length, 1 byte
// 5. filename symbols
// 6. data length
// 7. data symbols
// 8. error correction symbols (the rest)

import { GenericGF, ReedSolomonDecoder, ReedSolomonEncoder } from "./lib.js";

// @ts-ignore
const FIELD = GenericGF.QR_CODE_FIELD_256();
// Choose parity bytes (e.g., 32 parity → RS(255,223), t = 16 byte errors)
const PARITY = 32;
export const BlockSize = 255 - PARITY;
// @ts-ignore
const enc = new ReedSolomonEncoder(FIELD);
// enc.init();
// @ts-ignore
const dec = new ReedSolomonDecoder(FIELD);
// dec.init();

// fixme remove unnecessary copying

export function rsEncodeBlock(block: Uint8Array): Uint8Array {
  if (block.length !== BlockSize) throw new Error(`block must be ${BlockSize} bytes`);
  const codeword = new Int32Array(255);
  for (let i = 0; i < BlockSize; i++) codeword[i] = block[i];
  enc.encode(codeword, PARITY);      // appends PARITY bytes in-place
  // copy back to Uint8Array
  const out = new Uint8Array(255);
  for (let i = 0; i < 255; i++) out[i] = codeword[i] & 0xFF;
  return out;
}

export function rsDecodeBlock(codeword: Uint8Array): Uint8Array {
  if (codeword.length !== 255) throw new Error('codeword must be 255 bytes');
  const cw = new Int32Array(255);
  for (let i = 0; i < 255; i++) cw[i] = codeword[i];
  dec.decode(cw, PARITY);            // corrects in-place up to PARITY/2 byte errors
  const data = new Uint8Array(BlockSize);
  for (let i = 0; i < BlockSize; i++) data[i] = cw[i] & 0xFF;
  return data;
}

function splitUint8Array(data: Uint8Array, segmentLength: number) {
     const segments = [];
    const totalSegments = Math.ceil(data.length / segmentLength);
    
    for (let i = 0; i < totalSegments; i++) {
        const start = i * segmentLength;
        const end = Math.min(start + segmentLength, data.length);
        const segment = new Uint8Array(segmentLength);
        segment.set(data.subarray(start, end));
        segments.push(segment);
    }
    
    return segments;
}

function joinUint8Arrays(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    
    return result;
}

export function addErrorCorrection(data: Uint8Array): Uint8Array {
  return joinUint8Arrays(splitUint8Array(data, BlockSize).map(segment => rsEncodeBlock(segment)));
}

export function decodeErrorCorrection(data: Uint8Array): Uint8Array {
  return joinUint8Arrays(splitUint8Array(data, 255).map(segment => rsDecodeBlock(segment)));
}