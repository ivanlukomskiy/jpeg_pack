import { DefaultEncodingConf, type DctCoefConf } from "./config";

export interface BitsIterator {
  next(): number | null;
  nextN(n: number): number | null
}

export function randomUint8Arr(lenBits: number) {
    if (lenBits % 8 != 0) throw new Error("length should be multiple of 8")
    const data = new Uint8Array(Math.ceil(lenBits / 8));
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.floor(Math.random() * 256);
    }
    return data;
}

export class BitsIteratorImpl implements BitsIterator {
  private data: Uint8Array;
  private currentByte: number = 0;
  private currentBit: number = 0;
  private readonly length;

  private constructor(data: Uint8Array, length: number) {
    this.data = data;
    this.length = length;
  }

  static fromText(text: string): BitsIteratorImpl {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const length = data.length * 8;
    return new BitsIteratorImpl(data, length);
  }

  static fromBytes(data: Uint8Array): BitsIteratorImpl {
    return new BitsIteratorImpl(data, data.length * 8);
  }

  static async fromFile(file: File): Promise<BitsIteratorImpl> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const data = new Uint8Array(arrayBuffer);
          const length = data.length * 8;
          resolve(new BitsIteratorImpl(data, length));
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  static random(length: number): BitsIteratorImpl {
    return new BitsIteratorImpl(randomUint8Arr(length), length);
  }

  next(): number | null {
    if (this.currentByte * 8 + this.currentBit >= this.length) {
      return null;
    }

    const byte = this.data[this.currentByte];
    const bitValue = (byte >> (7 - this.currentBit)) & 1;
    
    this.currentBit++;
    if (this.currentBit >= 8) {
      this.currentBit = 0;
      this.currentByte++;
    }
    
    return bitValue;
  }

  nextN(n: number = 8): number | null {
    if (n < 1 || n > 8) {
      throw new Error('n must be between 1 and 8');
    }
    let result = 0;
    for (let i = 0; i < n; i++) {
      // fixme maybe throw error if there's no more data?
      const byte = this.length / 8 <= this.currentByte ? 0 : this.data[this.currentByte];
      const bitValue = (byte >> (7 - this.currentBit)) & 1;
      result = (result << 1) | bitValue;
      this.currentBit++;
      if (this.currentBit >= 8) {
        this.currentBit = 0;
        this.currentByte++;
      }
    }
    return result;
  }
}

export function compareBits(array1: Uint8Array, array2: Uint8Array): number {
    if (array1.length !== array2.length) {
        throw new Error('Arrays must be of the same length');
    }

    let differentBits = 0;

    for (let i = 0; i < array1.length; i++) {
        const xorResult = array1[i] ^ array2[i];
        differentBits += countBits(xorResult);
    }

    return differentBits;
}

export function compareBytes(array1: Uint8Array, array2: Uint8Array): number {
    if (array1.length !== array2.length) {
        throw new Error('Arrays must be of the same length');
    }

    let differentBytes = 0;

    for (let i = 0; i < array1.length; i++) {
        if (array1[i] != array2[i]) differentBytes++;
    }

    return differentBytes;
}

let offsetToDct_: null | Record<number, string> = null;
let blockSize = 0;

function buildOffsetMap() {
  if (offsetToDct_ !== null) return offsetToDct_;
  const offsetToDct: Record<number, string> = {};
  let offset = 0;
  DefaultEncodingConf.lumaConf.forEach(c => {
    for (let i = 0; i < c.bitsCapacity; i++) {
      offsetToDct[offset] = `l_${c.x},${c.y}`
      offset++;
      blockSize++;
    }
  });
  DefaultEncodingConf.chromaConf.forEach(c => {
    for (let i = 0; i < c.bitsCapacity; i++) {
      offsetToDct[offset] = `cr_${c.x},${c.y}`
      offset++;
      blockSize++;
    }
  });
  DefaultEncodingConf.chromaConf.forEach(c => {
    for (let i = 0; i < c.bitsCapacity; i++) {
      offsetToDct[offset] = `cb_${c.x},${c.y}`
      offset++;
      blockSize++;
    }
  });
  offsetToDct_ = offsetToDct;
  return offsetToDct_;
}

export function buildErrSourceAcc() {
  const offsetMap = buildOffsetMap();
  const res: Record<string, number> = {};
  Object.values(offsetMap).forEach(val => {
    res[val] = 0;
  })
  return res;
}

export function normalizeErrorSources(acc: Record<string, number>) {
  DefaultEncodingConf.lumaConf.forEach(c => {
    for (let i = 0; i < c.bitsCapacity; i++) {
      acc[`l_${c.x},${c.y}`] /= c.bitsCapacity;
    }
  });
  DefaultEncodingConf.chromaConf.forEach(c => {
    for (let i = 0; i < c.bitsCapacity; i++) {
      acc[`cr_${c.x},${c.y}`] /= c.bitsCapacity;
    }
  });
  DefaultEncodingConf.chromaConf.forEach(c => {
    for (let i = 0; i < c.bitsCapacity; i++) {
      acc[`cb_${c.x},${c.y}`] /= c.bitsCapacity;
    }
  });
}

export function calculateErrorSources(array1: Uint8Array, array2: Uint8Array, acc: Record<string, number>) {
  if (array1.length !== array2.length) {
    throw new Error('Arrays must be of the same length');
  }
  const offsetMap = buildOffsetMap();
  
  for (let i = 0; i < array1.length; i++) {
        const byte1 = array1[i];
        const byte2 = array2[i];
        
        for (let bitPos = 7; bitPos >= 0; bitPos--) {
            const bit1 = (byte1 >> bitPos) & 1;
            const bit2 = (byte2 >> bitPos) & 1;
            if (bit1 !== bit2) {
              const offset = (i * 8 + (7 - bitPos)) % blockSize;
              const dctName = offsetMap[offset];
              acc[dctName]++;
            }
        }
    }
}

function countBits(byte: number): number {
    let count = 0;
    let temp = byte;
    while (temp > 0) {
        count += temp & 1;
        temp >>= 1;
    }
    return count;
}