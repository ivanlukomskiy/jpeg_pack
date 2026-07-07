import { GenericGF, ReedSolomonDecoder, ReedSolomonEncoder } from './lib.js';
const FIELD = GenericGF.QR_CODE_FIELD_256();

const PARITY = 32;
const CodewordSize = 255;

export const BlockSize = CodewordSize - PARITY;

const enc = new (ReedSolomonEncoder as any)(FIELD);
const dec = new (ReedSolomonDecoder as any)(FIELD);

export function rsEncodeBlock(block: Uint8Array): Uint8Array {
  if (block.length !== BlockSize) {
    throw new Error(`block must be ${BlockSize} bytes`);
  }

  const codeword = new Int32Array(CodewordSize);

  for (let i = 0; i < BlockSize; i++) {
    codeword[i] = block[i];
  }

  enc.encode(codeword, PARITY);

  const result = new Uint8Array(CodewordSize);

  for (let i = 0; i < CodewordSize; i++) {
    result[i] = codeword[i];
  }

  return result;
}

export function rsDecodeBlock(codeword: Uint8Array): Uint8Array {
  if (codeword.length !== CodewordSize) {
    throw new Error(`codeword must be ${CodewordSize} bytes`);
  }

  const received = new Int32Array(CodewordSize);

  for (let i = 0; i < CodewordSize; i++) {
    received[i] = codeword[i];
  }

  dec.decode(received, PARITY);

  const result = new Uint8Array(BlockSize);

  for (let i = 0; i < BlockSize; i++) {
    result[i] = received[i];
  }

  return result;
}

export function addErrorCorrection(data: Uint8Array): Uint8Array {
  if (data.length % BlockSize !== 0) {
    throw new Error(`data length must be divisible by ${BlockSize}`);
  }

  const blockCount = data.length / BlockSize;
  const codewords = new Array<Uint8Array>(blockCount);

  for (let block = 0; block < blockCount; block++) {
    const start = block * BlockSize;
    codewords[block] = rsEncodeBlock(data.subarray(start, start + BlockSize));
  }

  const result = new Uint8Array(blockCount * CodewordSize);

  for (let symbol = 0; symbol < CodewordSize; symbol++) {
    for (let block = 0; block < blockCount; block++) {
      result[symbol * blockCount + block] = codewords[block][symbol];
    }
  }

  return result;
}

export function decodeErrorCorrection(data: Uint8Array): Uint8Array {
  if (data.length % CodewordSize !== 0) {
    throw new Error(`encoded data length must be divisible by ${CodewordSize}`);
  }

  const blockCount = data.length / CodewordSize;
  const result = new Uint8Array(blockCount * BlockSize);
  const codeword = new Uint8Array(CodewordSize);

  for (let block = 0; block < blockCount; block++) {
    for (let symbol = 0; symbol < CodewordSize; symbol++) {
      codeword[symbol] = data[symbol * blockCount + block];
    }

    result.set(rsDecodeBlock(codeword), block * BlockSize);
  }

  return result;
}