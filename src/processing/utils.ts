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

export async function jpegRoundTripBgr32f(cv, bgr32f, quality = 0.95, unitRange = true) {
    // --- ENCODE ---
    // 1) Convert 32F -> 8U (and scale if needed)
    const bgr8 = new cv.Mat();
    const encScale = unitRange ? 255.0 : 1.0;
    bgr32f.convertTo(bgr8, cv.CV_8UC3, encScale);

    // 2) BGR -> RGBA (canvas expects RGBA)
    const rgba = new cv.Mat();
    cv.cvtColor(bgr8, rgba, cv.COLOR_BGR2RGBA);
    bgr8.delete();

    // 3) Draw to canvas & encode to JPEG
    const encCanvas = document.createElement('canvas');
    encCanvas.width = rgba.cols;
    encCanvas.height = rgba.rows;
    cv.imshow(encCanvas, rgba);
    rgba.delete();

    const blob = await new Promise(res => encCanvas.toBlob(res, 'image/jpeg', quality));

    // --- DECODE ---
    // 4) Decode JPEG with <img>, draw back to a canvas
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

    // 5) Read pixels into RGBA Mat
    const imageData = dctx.getImageData(0, 0, decCanvas.width, decCanvas.height);
    const rgbaDec = cv.matFromImageData(imageData);

    // 6) RGBA -> BGR 8U
    const bgr8Decoded = new cv.Mat();
    cv.cvtColor(rgbaDec, bgr8Decoded, cv.COLOR_RGBA2BGR);
    rgbaDec.delete();

    // 7) 8U -> 32F (and scale back if we scaled on encode)
    const bgr32fDecoded = new cv.Mat();
    const decScale = unitRange ? (1.0 / 255.0) : 1.0;
    bgr8Decoded.convertTo(bgr32fDecoded, cv.CV_32FC3, decScale);
    bgr8Decoded.delete();

    return { bgr32fDecoded, blob };
}