export function splitUint8Array(data: Uint8Array, segmentLength: number) {
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

export function joinUint8Arrays(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    
    return result;
}

export function intToByteArray(num: number) {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, num, false);
  return new Uint8Array(buffer);
}

export function byteArrayToInt(uint8Array: Uint8Array): number {
    return (uint8Array[0] << 24) | 
           (uint8Array[1] << 16) | 
           (uint8Array[2] << 8) | 
           uint8Array[3];
}