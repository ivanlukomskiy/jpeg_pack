// ===== DCT/IDCT for OpenCV.js (8x8 block JPEG-style) =====

export class DctCalc {
  private cv: any;
  private DCT8: any;
  private DCT8T: any;

  constructor(cv: any) {
    this.cv = cv;
  }

  public init() {
    this.DCT8 = this.buildDCTMatrix(8);
    this.DCT8T = new this.cv.Mat();
    this.cv.transpose(this.DCT8, this.DCT8T);
  }

  public cleanup() {
    this.DCT8.delete();
    this.DCT8T.delete();
  }

  private buildDCTMatrix(N: number) {
    const C = new this.cv.Mat(N, N, this.cv.CV_32F);
    const s = Math.sqrt(2.0 / N);
    for (let u = 0; u < N; u++) {
      const alpha = u === 0 ? Math.sqrt(0.5) : 1.0;
      for (let x = 0; x < N; x++) {
        const val = s * alpha * Math.cos((Math.PI * (2 * x + 1) * u) / (2 * N));
        C.floatPtr(u, x)[0] = val;
      }
    }
    return C;
  }

  // Perform DCT on one 8x8 single-channel block (src8 -> dst8), both CV_32F
  private dctBlock8(src8: any, dst8: any) {
    // tmp = DCT8 * src8
    const tmp = new this.cv.Mat();
    this.cv.gemm(this.DCT8, src8, 1.0, new this.cv.Mat(), 0.0, tmp); // tmp = DCT8 * src
    // dst = tmp * DCT8^T
    this.cv.gemm(tmp, this.DCT8T, 1.0, new this.cv.Mat(), 0.0, dst8); // dst = tmp * Ct
    tmp.delete();
  }

  // Perform inverse DCT on one 8x8 single-channel block (src8 -> dst8), both CV_32F
  private idctBlock8(src8: any, dst8: any) {
    // tmp = DCT8^T * src8
    const tmp = new this.cv.Mat();
    this.cv.gemm(this.DCT8T, src8, 1.0, new this.cv.Mat(), 0.0, tmp); // tmp = Ct * src
    // dst = tmp * DCT8
    this.cv.gemm(tmp, this.DCT8, 1.0, new this.cv.Mat(), 0.0, dst8); // dst = tmp * C
    tmp.delete();
  }

  private processBlocks8(src32f: any, inverse: boolean) {
    if (src32f.type() !== this.cv.CV_32F || src32f.channels() !== 1) {
      throw new Error('processBlocks8 expects single-channel CV_32F input');
    }
    const h = src32f.rows,
      w = src32f.cols;
    if (w % 8 !== 0 || h % 8 !== 0) {
      throw new Error('Image size must be a multiple of 8 (pad beforehand if needed).');
    }
    const dst32f = this.cv.Mat.zeros(h, w, this.cv.CV_32F);
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
          this.idctBlock8(srcBlock, dstBlock);
        } else {
          this.dctBlock8(srcBlock, dstBlock);
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

  public dct8x8Mat(srcMat: any) {
    return this.processBlocks8(srcMat, false);
  }

  public idct8x8Mat(srcMat: any) {
    return this.processBlocks8(srcMat, true);
  }
}
