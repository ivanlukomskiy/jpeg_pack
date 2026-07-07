// 1. hash: 8 bytes
// 2. type: 1 byte
// 3. if type==file, filename length, 1 byte
// 4. filename symbols
// 5. data length
// 6. data symbols

import { countTotalBits } from '../processing/blocks_iterator.ts';
import type { EncodingConf } from '../processing/config';
import { DefaultEncodingConf } from '../processing/config';
import { addErrorCorrection, BlockSize, decodeErrorCorrection } from '../processing/reed_solomon/adapter';
import { byteArrayToInt, type FileResult, intToByteArray, joinUint8Arrays } from '../processing/utils';

export function getFullByteCapacity(
  width: number,
  height: number,
  conf: EncodingConf = DefaultEncodingConf,
): number {
  const capacityBytes = countTotalBits(width, height, conf) / 8;
  return Math.floor(capacityBytes / 255) * 255;
}

const TYPE_FILE = 1;

async function get8ByteHash(data: Uint8Array) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as any);
  const hashArray = new Uint8Array(hashBuffer);
  return hashArray.slice(0, 8);
}

export async function encodeFile(filename: string, data: Uint8Array, rsByteCapacity?: number) {
  const type = new Uint8Array([TYPE_FILE]);
  const textEnc = new TextEncoder();
  const filenameBytes = textEnc.encode(filename);
  if (filenameBytes.length > 255) throw new Error('filename too long');
  const filenameSize = new Uint8Array([filenameBytes.length]);
  const dataLength = intToByteArray(data.length);
  const payloadWithoutHash = joinUint8Arrays([type, filenameSize, filenameBytes, dataLength, data]);
  const hash = await get8ByteHash(payloadWithoutHash);
  let payloadWithHash = joinUint8Arrays([hash, payloadWithoutHash]);

  if (rsByteCapacity !== undefined) {
    const targetPreRsBytes = (rsByteCapacity / 255) * BlockSize;
    if (payloadWithHash.length > targetPreRsBytes) {
      throw new Error('payload too large for image RS capacity');
    }
    if (payloadWithHash.length < targetPreRsBytes) {
      const padded = new Uint8Array(targetPreRsBytes);
      padded.set(payloadWithHash);
      payloadWithHash = padded;
    }
  }

  const rsEncoded = addErrorCorrection(payloadWithHash);
  if (rsByteCapacity !== undefined && rsEncoded.length !== rsByteCapacity) {
    throw new Error(`RS encoded length ${rsEncoded.length} does not match capacity ${rsByteCapacity}`);
  }
  return rsEncoded;
}

export function getApproxEffectiveCapacityBytes(fullSizeBytes: number): number {
  const afterErrorCorrection = (BlockSize / 255) * fullSizeBytes;
  return Math.floor(afterErrorCorrection - 8 - 1 - 20 - 4);
}

export async function decodeFile(raw: Uint8Array): Promise<FileResult> {
  const decoded = decodeErrorCorrection(raw);
  // console.log('decoded', decoded);

  let idx = 0;

  const hash = decoded.subarray(idx, idx + 8);
  idx += 8;

  const typeArr = decoded.subarray(idx, idx + 1);
  idx += 1;

  const filenameSize = decoded.subarray(idx, idx + 1);
  idx += 1;

  const filenameArr = decoded.subarray(idx, idx + filenameSize[0]);
  idx += filenameSize[0];

  const dataLengthArr = decoded.subarray(idx, idx + 4);
  const dataLength = byteArrayToInt(decoded.subarray(idx, idx + 4));
  idx += 4;

  const data = decoded.subarray(idx, idx + dataLength);

  const payloadWithoutHash = joinUint8Arrays([typeArr, filenameSize, filenameArr, dataLengthArr, data]);
  const actualHash = await get8ByteHash(payloadWithoutHash);

  for (let i = 0; i < 8; i++) {
    if (hash[i] != actualHash[i]) {
      console.log(hash);
      console.log(actualHash);
      throw new Error('Hashes mismatch');
    }
  }

  const textDec = new TextDecoder();
  const filename = textDec.decode(filenameArr);

  return { filename, data };
}
