import { joinUint8Arrays, splitUint8Array } from "../utils.js";
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

export function addErrorCorrection(data: Uint8Array): Uint8Array {
  return joinUint8Arrays(splitUint8Array(data, BlockSize).map(segment => rsEncodeBlock(segment)));
}

export function decodeErrorCorrection(data: Uint8Array): Uint8Array {
  return joinUint8Arrays(splitUint8Array(data, 255).map(segment => rsDecodeBlock(segment)));
}