// ===== DCT/IDCT for OpenCV.js (8x8 block JPEG-style) =====

export class DctCalc {
  cv: any;
  DCT8: any;
  DCT8T: any;

  constructor(cv: any) {
    this.cv = cv;
  }

  init() {
    this.DCT8 = this.buildDCTMatrix(8);
    this.DCT8T = new this.cv.Mat();
    this.cv.transpose(this.DCT8, this.DCT8T);
  }

  cleanup() {
    this.DCT8.delete(); 
    this.DCT8T.delete();
  }

  buildDCTMatrix(N: number) {
    const C = new this.cv.Mat(N, N, this.cv.CV_32F);
    const s = Math.sqrt(2.0 / N);
    for (let u = 0; u < N; u++) {
      const alpha = (u === 0) ? Math.sqrt(0.5) : 1.0;
      for (let x = 0; x < N; x++) {
        const val = s * alpha * Math.cos((Math.PI * (2 * x + 1) * u) / (2 * N));
        C.floatPtr(u, x)[0] = val;
      }
    }
    return C;
  }

  // Perform DCT on one 8x8 single-channel block (src8 -> dst8), both CV_32F
  dctBlock8(src8: any, dst8: any) {
    // tmp = DCT8 * src8
    const tmp = new this.cv.Mat();
    this.cv.gemm(this.DCT8, src8, 1.0, new this.cv.Mat(), 0.0, tmp);   // tmp = DCT8 * src
    // dst = tmp * DCT8^T
    this.cv.gemm(tmp, this.DCT8T, 1.0, new this.cv.Mat(), 0.0, dst8);  // dst = tmp * Ct
    tmp.delete();
  }

  // Perform inverse DCT on one 8x8 single-channel block (src8 -> dst8), both CV_32F
  idctBlock8(src8: any, dst8: any) {
    // tmp = DCT8^T * src8
    const tmp = new this.cv.Mat();
    this.cv.gemm(this.DCT8T, src8, 1.0, new this.cv.Mat(), 0.0, tmp);  // tmp = Ct * src
    // dst = tmp * DCT8
    this.cv.gemm(tmp, this.DCT8, 1.0, new this.cv.Mat(), 0.0, dst8);   // dst = tmp * C
    tmp.delete();
  }

  // Helper: ensure CV_32F single-channel; (optionally) center by -128 and return a new Mat
 ensureFloatSingle(src: any, center=false) {
  let gray = src;
  let needToDeleteGray = false;
  if (src.channels() > 1) {
    gray = new this.cv.Mat();
    this.cv.cvtColor(src, gray, this.cv.COLOR_RGBA2GRAY); // or COLOR_BGR2GRAY based on your input
    needToDeleteGray = true;
  }
  const f32 = new this.cv.Mat();
  gray.convertTo(f32, this.cv.CV_32F);
  if (center) {
    const shift = new this.cv.Mat(f32.rows, f32.cols, this.cv.CV_32F, new this.cv.Scalar(128));
    this.cv.subtract(f32, shift, f32);
    shift.delete();
  }
  if (needToDeleteGray) gray.delete();
  return f32;
}

// Helper: reverse of ensureFloatSingle (optionally) un-center by +128 and convert to 8U
to8U(mat32f, uncenter=false) {
  const out = new this.cv.Mat();
  if (uncenter) {
    const shift = new this.cv.Mat(mat32f.rows, mat32f.cols, this.cv.CV_32F, new this.cv.Scalar(128));
    this.cv.add(mat32f, shift, mat32f);
    shift.delete();
  }
  // clamp then convert
  const clamped = new this.cv.Mat();
  this.cv.min(mat32f, new this.cv.Mat(mat32f.rows, mat32f.cols, this.cv.CV_32F, new this.cv.Scalar(255)), clamped);
  this.cv.max(clamped, new this.cv.Mat(clamped.rows, clamped.cols, this.cv.CV_32F, new this.cv.Scalar(0)), clamped);
  clamped.convertTo(out, this.cv.CV_8U);
  clamped.delete();
  return out;
}

// Core: process single-channel CV_32F image in 8x8 blocks with a given block op (dctBlock8/idctBlock8)
processBlocks8(src32f, inverse: boolean) {
  if (src32f.type() !== this.cv.CV_32F || src32f.channels() !== 1) {
    throw new Error("processBlocks8 expects single-channel CV_32F input");
  }
  const h = src32f.rows, w = src32f.cols;
  if ((w % 8) !== 0 || (h % 8) !== 0) {
    throw new Error("Image size must be a multiple of 8 (pad beforehand if needed).");
  }
  const dst32f = new this.cv.Mat.zeros(h, w, this.cv.CV_32F);
  // temp 8x8 buffers
  const srcBlock = new this.cv.Mat(8, 8, this.cv.CV_32F);
  const dstBlock = new this.cv.Mat(8, 8, this.cv.CV_32F);

  for (let y = 0; y < h; y += 8) {
    for (let x = 0; x < w; x += 8) {
      // roi views
      const r = new this.cv.Rect(x, y, 8, 8);
      const srcROI = src32f.roi(r);
      const dstROI = dst32f.roi(r);

      // copy to compact blocks to ensure contiguous memory
      srcROI.copyTo(srcBlock);
      if (inverse) {
        this.idctBlock8(srcBlock, dstBlock)
      } else {
        this.dctBlock8(srcBlock, dstBlock)
      }
      dstBlock.copyTo(dstROI);

      // clean roi headers
      srcROI.delete();
      dstROI.delete();
    }
  }

  srcBlock.delete();
  dstBlock.delete();
  return dst32f;
}

// Public: DCT over 8x8 blocks.
// - If input is multi-channel, it will be split and processed per channel (keeping CV_32F).
// - center: subtract 128 (JPEG-style) before DCT for 8-bit imagery.
dct8x8Mat(srcMat, {center=false, padToMultipleOf8=false} = {}) {
  let src = srcMat;

  // Optional zero padding to next multiple of 8
  let padded = null;
  if (padToMultipleOf8 && (src.rows % 8 !== 0 || src.cols % 8 !== 0)) {
    const newH = Math.ceil(src.rows / 8) * 8;
    const newW = Math.ceil(src.cols / 8) * 8;
    padded = new this.cv.Mat.zeros(newH, newW, src.type());
    const roi = padded.roi(new this.cv.Rect(0, 0, src.cols, src.rows));
    src.copyTo(roi);
    roi.delete();
    src = padded; // work on padded
  }

  let dst;
  if (src.channels() === 1) {
    const f32 = this.ensureFloatSingle(src, center);
    dst = this.processBlocks8(f32, false);
    f32.delete();
  } else {
    // Split, convert each to CV_32F, process, and merge back (still CV_32F)
    const planes = new this.cv.MatVector();
    this.cv.split(src, planes);
    const outPlanes = new this.cv.MatVector();
    for (let c = 0; c < planes.size(); c++) {
      const f32 = new this.cv.Mat();
      planes.get(c).convertTo(f32, this.cv.CV_32F);
      if (center) {
        const shift = new this.cv.Mat(f32.rows, f32.cols, this.cv.CV_32F, new this.cv.Scalar(128));
        this.cv.subtract(f32, shift, f32);
        shift.delete();
      }
      const dctCh = this.processBlocks8(f32, false);
      outPlanes.push_back(dctCh);
      f32.delete(); dctCh.delete(); // push_back makes its own header copy
    }
    dst = new this.cv.Mat();
    this.cv.merge(outPlanes, dst);
    // Clean up vectors (they only own headers here)
    for (let i = 0; i < planes.size(); i++) planes.get(i).delete();
    planes.delete();
    outPlanes.delete();
  }

  if (padded) padded.delete();
  return dst; // CV_32F, same size (possibly padded)
}

// Public: inverse DCT over 8x8 blocks.
// - If input had center=true during DCT for 8-bit images, pass uncenter=true to add back +128 after IDCT.
// - Returns CV_32F by default. Convert to 8U with to8U() if you want.
  idct8x8Mat(srcMat, {uncenter=false} = {}) {
  let dst;
  if (srcMat.channels() === 1) {
    const f32 = (srcMat.type() === this.cv.CV_32F) ? srcMat.clone() : (() => {
      const t = new this.cv.Mat(); srcMat.convertTo(t, this.cv.CV_32F); return t;
    })();
    dst = this.processBlocks8(f32, true);
    if (uncenter) {
      const shift = new this.cv.Mat(dst.rows, dst.cols, this.cv.CV_32F, new this.cv.Scalar(128));
      this.cv.add(dst, shift, dst);
      shift.delete();
    }
    f32.delete();
  } else {
    const planes = new this.cv.MatVector();
    this.cv.split(srcMat, planes);
    const outPlanes = new this.cv.MatVector();
    for (let c = 0; c < planes.size(); c++) {
      const f32 = new this.cv.Mat();
      planes.get(c).convertTo(f32, this.cv.CV_32F);
      const idctCh = this.processBlocks8(f32, true);
      if (uncenter) {
        const shift = new this.cv.Mat(idctCh.rows, idctCh.cols, this.cv.CV_32F, new this.cv.Scalar(128));
        this.cv.add(idctCh, shift, idctCh);
        shift.delete();
      }
      outPlanes.push_back(idctCh);
      f32.delete(); idctCh.delete();
    }
    dst = new this.cv.Mat();
    this.cv.merge(outPlanes, dst);
    for (let i = 0; i < planes.size(); i++) planes.get(i).delete();
    planes.delete();
    outPlanes.delete();
  }
  return dst; // CV_32F
}
}
