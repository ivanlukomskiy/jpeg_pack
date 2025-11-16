export interface FileResult {
    filename: string;
    data: Uint8Array;
}

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
export async function getJpegSubsampling(file) {
    // File and Blob both support .arrayBuffer()
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let i = 0;

    // Must start with SOI (0xFFD8)
    if (bytes[i++] !== 0xFF || bytes[i++] !== 0xD8) {
        throw new Error('Not a JPEG file');
    }

    while (i < bytes.length) {
        // Find next marker
        while (i < bytes.length && bytes[i] !== 0xFF) i++;
        while (i < bytes.length && bytes[i] === 0xFF) i++;
        const marker = bytes[i++];

        // End of Image (EOI) or Start of Scan (SOS) => stop parsing headers
        if (marker === 0xD9 || marker === 0xDA) break;

        // Segment length (includes the length field itself)
        const len = (bytes[i++] << 8) | bytes[i++];
        const segStart = i;

        // SOF0 (0xC0) or SOF2 (0xC2) contains sampling factors
        if (marker === 0xC0 || marker === 0xC2) {
            const precision = bytes[i++];
            const height = (bytes[i++] << 8) | bytes[i++];
            const width  = (bytes[i++] << 8) | bytes[i++];
            const nComp  = bytes[i++];

            const comps = [];
            for (let c = 0; c < nComp; c++) {
                const id = bytes[i++];      // Component ID (1=Y, 2=Cb, 3=Cr)
                const hv = bytes[i++];      // High nibble: H, low nibble: V
                const q  = bytes[i++];      // Quantization table selector
                comps.push({ id, H: hv >> 4, V: hv & 0xF, q });
            }

            const Y  = comps.find(c => c.id === 1) || comps[0];
            const Cb = comps.find(c => c.id === 2);
            const Cr = comps.find(c => c.id === 3);

            const label = (() => {
                if (!Cb || !Cr) return 'grayscale';
                const key = `${Y.H}x${Y.V}-${Cb.H}x${Cb.V}-${Cr.H}x${Cr.V}`;
                switch (key) {
                    case '1x1-1x1-1x1': return '4:4:4';
                    case '2x1-1x1-1x1': return '4:2:2';
                    case '2x2-1x1-1x1': return '4:2:0';
                    case '1x2-1x1-1x1': return '4:4:0';
                    default: return `non-canonical (Y ${Y.H}x${Y.V}, Cb ${Cb.H}x${Cb.V}, Cr ${Cr.H}x${Cr.V})`;
                }
            })();

            return { width, height, precision, components: comps, subsampling: label };
        }

        // Skip to next segment
        i = segStart + len - 2;
    }

    throw new Error('No SOF segment found');
}

export function printMat(mat: any): string {
    const rows = mat.rows;
    const cols = mat.cols;
    const channels = mat.channels();
    let result = '';

    for (let r = 0; r < rows; r++) {
      let rowStr = '';
      for (let c = 0; c < cols; c++) {
        let pixelStr = '';
        for (let ch = 0; ch < channels; ch++) {
          const value = mat.ucharPtr(r, c)[ch];
          pixelStr += value.toFixed(2);
          if (ch < channels - 1) pixelStr += ', ';
        }
        rowStr += `[${pixelStr}] `;
      }
      result += rowStr.trim() + '\n';
    }

    return result;
}


export function fileToUint8Array(file: File): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event: any) => {
            const arrayBuffer = event.target.result;
            const uint8Array = new Uint8Array(arrayBuffer);
            resolve(uint8Array);
        };

        reader.onerror = (error) => {
            reject(error);
        };

        reader.readAsArrayBuffer(file);
    });
}

export function generateTimestampedId() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // "YYYY-MM-DD"
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomStr = '';
    for (let i = 0; i < 8; i++) {
        randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${dateStr}-${randomStr}`;
}

export async function decodeJpeg(cv, jpegBytes: Uint8Array) {
    const blob = new Blob([jpegBytes], { type: 'image/jpeg' });
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
    const imageData = dctx.getImageData(0, 0, decCanvas.width, decCanvas.height);
    const rgbaDec = cv.matFromImageData(imageData);
    const bgr8Decoded = new cv.Mat();
    cv.cvtColor(rgbaDec, bgr8Decoded, cv.COLOR_RGBA2BGR);
    rgbaDec.delete();
    const bgr32fDecoded = new cv.Mat();
    bgr8Decoded.convertTo(bgr32fDecoded, cv.CV_32F, 1.0 / 255.0);
    bgr8Decoded.delete();
    return { bgr32fDecoded: bgr32fDecoded, blob };
}

export function downloadFile(filename: string, data: Uint8Array) {
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
export function serializeMat(mat: any) {
    const data = mat.data.slice().buffer

    const matData = {
        data,
        rows: mat.rows,
        cols: mat.cols,
        type: mat.type(),
    }

    mat.delete()
    return matData
}

export function deserializeMat(matData: any, cv: any) {
    const mat = new cv.Mat(matData.rows, matData.cols, matData.type)
    const src = new (mat.data.constructor as any)(matData.data)
    mat.data.set(src)
    return mat
}

export async function matToJpegFileResult(
    mat: any,
    filename = "image.jpg",
    quality = 0.9
): Promise<FileResult> {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create 2D context");

    canvas.width = mat.cols;
    canvas.height = mat.rows;

    const imageData = ctx.createImageData(mat.cols, mat.rows);
    const data = imageData.data;
    const matData = mat.data32F;

    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
        const b = Math.min(255, Math.max(0, matData[j] * 255));
        const g = Math.min(255, Math.max(0, matData[j + 1] * 255));
        const r = Math.min(255, Math.max(0, matData[j + 2] * 255));

        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);

    const blob: Blob = await new Promise(resolve =>
        canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) throw new Error("Failed to encode JPEG");

    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    return { filename, data: uint8 };
}

