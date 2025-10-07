// ===== DCT/IDCT for OpenCV.js (8x8 block JPEG-style) =====

// Build an orthonormal DCT-II matrix of size N
function buildDCTMatrix(N) {
  const C = new cv.Mat(N, N, cv.CV_32F);
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

// Precompute DCT basis for 8x8
let cv = null // fixme
let DCT8 = null;
let DCT8T = null;
function precomputeDCTBasis() {
    DCT8 = buildDCTMatrix(8);
    DCT8T = new cv.Mat();
    cv.transpose(DCT8, DCT8T);
}


// Perform DCT on one 8x8 single-channel block (src8 -> dst8), both CV_32F
function dctBlock8(src8, dst8) {
  // tmp = DCT8 * src8
  const tmp = new cv.Mat();
  cv.gemm(DCT8, src8, 1.0, new cv.Mat(), 0.0, tmp);   // tmp = DCT8 * src
  // dst = tmp * DCT8^T
  cv.gemm(tmp, DCT8T, 1.0, new cv.Mat(), 0.0, dst8);  // dst = tmp * Ct
  tmp.delete();
}

// Perform inverse DCT on one 8x8 single-channel block (src8 -> dst8), both CV_32F
function idctBlock8(src8, dst8) {
  // tmp = DCT8^T * src8
  const tmp = new cv.Mat();
  cv.gemm(DCT8T, src8, 1.0, new cv.Mat(), 0.0, tmp);  // tmp = Ct * src
  // dst = tmp * DCT8
  cv.gemm(tmp, DCT8, 1.0, new cv.Mat(), 0.0, dst8);   // dst = tmp * C
  tmp.delete();
}

// Helper: ensure CV_32F single-channel; (optionally) center by -128 and return a new Mat
function ensureFloatSingle(src, center=false) {
  let gray = src;
  let needToDeleteGray = false;
  if (src.channels() > 1) {
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY); // or COLOR_BGR2GRAY based on your input
    needToDeleteGray = true;
  }
  const f32 = new cv.Mat();
  gray.convertTo(f32, cv.CV_32F);
  if (center) {
    const shift = new cv.Mat(f32.rows, f32.cols, cv.CV_32F, new cv.Scalar(128));
    cv.subtract(f32, shift, f32);
    shift.delete();
  }
  if (needToDeleteGray) gray.delete();
  return f32;
}

// Helper: reverse of ensureFloatSingle (optionally) un-center by +128 and convert to 8U
function to8U(mat32f, uncenter=false) {
  let out = new cv.Mat();
  if (uncenter) {
    const shift = new cv.Mat(mat32f.rows, mat32f.cols, cv.CV_32F, new cv.Scalar(128));
    cv.add(mat32f, shift, mat32f);
    shift.delete();
  }
  // clamp then convert
  const clamped = new cv.Mat();
  cv.min(mat32f, new cv.Mat(mat32f.rows, mat32f.cols, cv.CV_32F, new cv.Scalar(255)), clamped);
  cv.max(clamped, new cv.Mat(clamped.rows, clamped.cols, cv.CV_32F, new cv.Scalar(0)), clamped);
  clamped.convertTo(out, cv.CV_8U);
  clamped.delete();
  return out;
}

// Core: process single-channel CV_32F image in 8x8 blocks with a given block op (dctBlock8/idctBlock8)
function processBlocks8(src32f, blockOp) {
  if (src32f.type() !== cv.CV_32F || src32f.channels() !== 1) {
    throw new Error("processBlocks8 expects single-channel CV_32F input");
  }
  const h = src32f.rows, w = src32f.cols;
  if ((w % 8) !== 0 || (h % 8) !== 0) {
    throw new Error("Image size must be a multiple of 8 (pad beforehand if needed).");
  }
  const dst32f = new cv.Mat.zeros(h, w, cv.CV_32F);
  // temp 8x8 buffers
  const srcBlock = new cv.Mat(8, 8, cv.CV_32F);
  const dstBlock = new cv.Mat(8, 8, cv.CV_32F);

  for (let y = 0; y < h; y += 8) {
    for (let x = 0; x < w; x += 8) {
      // roi views
      const r = new cv.Rect(x, y, 8, 8);
      const srcROI = src32f.roi(r);
      const dstROI = dst32f.roi(r);

      // copy to compact blocks to ensure contiguous memory
      srcROI.copyTo(srcBlock);
      blockOp(srcBlock, dstBlock);
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
export function dct8x8Mat(cv_, srcMat, {center=false, padToMultipleOf8=false} = {}) {
    cv = cv_;
    precomputeDCTBasis()
  let src = srcMat;

  // Optional zero padding to next multiple of 8
  let padded = null;
  if (padToMultipleOf8 && (src.rows % 8 !== 0 || src.cols % 8 !== 0)) {
    const newH = Math.ceil(src.rows / 8) * 8;
    const newW = Math.ceil(src.cols / 8) * 8;
    padded = new cv.Mat.zeros(newH, newW, src.type());
    const roi = padded.roi(new cv.Rect(0, 0, src.cols, src.rows));
    src.copyTo(roi);
    roi.delete();
    src = padded; // work on padded
  }

  let dst;
  if (src.channels() === 1) {
    const f32 = ensureFloatSingle(src, center);
    dst = processBlocks8(f32, dctBlock8);
    f32.delete();
  } else {
    // Split, convert each to CV_32F, process, and merge back (still CV_32F)
    const planes = new cv.MatVector();
    cv.split(src, planes);
    const outPlanes = new cv.MatVector();
    for (let c = 0; c < planes.size(); c++) {
      const f32 = new cv.Mat();
      planes.get(c).convertTo(f32, cv.CV_32F);
      if (center) {
        const shift = new cv.Mat(f32.rows, f32.cols, cv.CV_32F, new cv.Scalar(128));
        cv.subtract(f32, shift, f32);
        shift.delete();
      }
      const dctCh = processBlocks8(f32, dctBlock8);
      outPlanes.push_back(dctCh);
      f32.delete(); dctCh.delete(); // push_back makes its own header copy
    }
    dst = new cv.Mat();
    cv.merge(outPlanes, dst);
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
export function idct8x8Mat(cv_, srcMat, {uncenter=false} = {}) {
    cv = cv_;
    precomputeDCTBasis()
  let dst;
  if (srcMat.channels() === 1) {
    const f32 = (srcMat.type() === cv.CV_32F) ? srcMat.clone() : (() => {
      const t = new cv.Mat(); srcMat.convertTo(t, cv.CV_32F); return t;
    })();
    dst = processBlocks8(f32, idctBlock8);
    if (uncenter) {
      const shift = new cv.Mat(dst.rows, dst.cols, cv.CV_32F, new cv.Scalar(128));
      cv.add(dst, shift, dst);
      shift.delete();
    }
    f32.delete();
  } else {
    const planes = new cv.MatVector();
    cv.split(srcMat, planes);
    const outPlanes = new cv.MatVector();
    for (let c = 0; c < planes.size(); c++) {
      const f32 = new cv.Mat();
      planes.get(c).convertTo(f32, cv.CV_32F);
      const idctCh = processBlocks8(f32, idctBlock8);
      if (uncenter) {
        const shift = new cv.Mat(idctCh.rows, idctCh.cols, cv.CV_32F, new cv.Scalar(128));
        cv.add(idctCh, shift, idctCh);
        shift.delete();
      }
      outPlanes.push_back(idctCh);
      f32.delete(); idctCh.delete();
    }
    dst = new cv.Mat();
    cv.merge(outPlanes, dst);
    for (let i = 0; i < planes.size(); i++) planes.get(i).delete();
    planes.delete();
    outPlanes.delete();
  }
  return dst; // CV_32F
}

// ===== Example usage =====
// Assume `src8u` is an 8-bit single-channel or 3-channel cv.Mat.
// const dct = dct8x8Mat(src8u, {center:true, padToMultipleOf8:true}); // CV_32F coefficients
// ... (you can quantize/zigzag/etc here) ...
// const rec32f = idct8x8Mat(dct, {uncenter:true});
// const rec8u = to8U(rec32f, false); // already uncentered above
// cv.imshow('canvasOutput', rec8u);
// dct.delete(); rec32f.delete(); rec8u.delete();

// ===== Cleanup precomputed matrices if you’re done entirely =====
// DCT8.delete(); DCT8T.delete();