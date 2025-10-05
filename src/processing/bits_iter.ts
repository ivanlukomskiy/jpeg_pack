export interface BitsIterator {
  next(): number | null;
  nextN(n: number): number | null
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

  // e.g. "101010"
  static fromBitString(bitsString: string): BitsIteratorImpl {
    const length = bitsString.length;
    if (length % 8 != 0) throw new Error("string bits length should be muliple of 8")
    const data = new Uint8Array(Math.ceil(length / 8));
    
    for (let i = 0; i < length; i++) {
      const bit = bitsString[i];
      if (bit !== '0' && bit !== '1') {
        throw new Error(`Invalid bit character: ${bit}`);
      }
      
      const byteIndex = Math.floor(i / 8);
      const bitIndex = 7 - (i % 8);
      
      if (bit === '1') {
        data[byteIndex] |= (1 << bitIndex);
      }
    }
    
    return new BitsIteratorImpl(data, length);
  }

  // e.g., [1, 0, 1, 0]
  static fromArray(bitsArray: number[]): BitsIteratorImpl {
    const length = bitsArray.length;
    const data = new Uint8Array(Math.ceil(length / 8));
    
    for (let i = 0; i < length; i++) {
      const bit = bitsArray[i];
      if (bit !== 0 && bit !== 1) {
        throw new Error(`Invalid bit value: ${bit}. Must be 0 or 1.`);
      }
      
      const byteIndex = Math.floor(i / 8);
      const bitIndex = 7 - (i % 8);
      
      if (bit === 1) {
        data[byteIndex] |= (1 << bitIndex);
      }
    }
    
    return new BitsIteratorImpl(data, length);
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
    if (length % 8 != 0) throw new Error("length should be multiple of 8")
    const data = new Uint8Array(Math.ceil(length / 8));
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.floor(Math.random() * 256);
    }
    return new BitsIteratorImpl(data, length);
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
