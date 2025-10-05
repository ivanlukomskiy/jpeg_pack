// 1D DCT-II (orthonormal)
function makeDCT1D(N) {
  const cosTable = Array.from({ length: N }, () => new Float64Array(N));
  for (let k = 0; k < N; k++) {
    for (let n = 0; n < N; n++) {
      cosTable[k][n] = Math.cos(((Math.PI * (2 * n + 1) * k) / (2 * N)));
    }
  }
  const alpha = new Float64Array(N);
  for (let k = 0; k < N; k++) alpha[k] = k === 0 ? 1 / Math.sqrt(2) : 1;

  return function dct1d(src, dst = new Float64Array(N)) {
    for (let k = 0; k < N; k++) {
      let sum = 0;
      const row = cosTable[k];
      for (let n = 0; n < N; n++) sum += src[n] * row[n];
      dst[k] = (Math.sqrt(2 / N) * alpha[k]) * sum;
    }
    return dst;
  };
}

// 1D IDCT-III (orthonormal inverse of the above)
function makeIDCT1D(N) {
  const cosTable = Array.from({ length: N }, () => new Float64Array(N));
  for (let n = 0; n < N; n++) {
    for (let k = 0; k < N; k++) {
      cosTable[n][k] = Math.cos(((Math.PI * (2 * n + 1) * k) / (2 * N)));
    }
  }
  const alpha = new Float64Array(N);
  for (let k = 0; k < N; k++) alpha[k] = k === 0 ? 1 / Math.sqrt(2) : 1;

  return function idct1d(src, dst = new Float64Array(N)) {
    for (let n = 0; n < N; n++) {
      let sum = 0;
      const row = cosTable[n];
      for (let k = 0; k < N; k++) sum += alpha[k] * src[k] * row[k];
      dst[n] = (Math.sqrt(2 / N)) * sum;
    }
    return dst;
  };
}

// 2D by separability (in-place on Float64Array/Float32Array)
export function dct2d(mat, rows, cols) {
  const dctRow = makeDCT1D(cols);
  const dctCol = makeDCT1D(rows);

  // rows
  const rowBuf = new Float64Array(cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) rowBuf[c] = mat[r * cols + c];
    const out = dctRow(rowBuf);
    for (let c = 0; c < cols; c++) mat[r * cols + c] = out[c];
  }

  // cols
  const colBuf = new Float64Array(rows);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) colBuf[r] = mat[r * cols + c];
    const out = dctCol(colBuf);
    for (let r = 0; r < rows; r++) mat[r * cols + c] = out[r];
  }
  return mat;
}

export function idct2d(mat, rows, cols) {
  const idctRow = makeIDCT1D(cols);
  const idctCol = makeIDCT1D(rows);

  // rows
  const rowBuf = new Float64Array(cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) rowBuf[c] = mat[r * cols + c];
    const out = idctRow(rowBuf);
    for (let c = 0; c < cols; c++) mat[r * cols + c] = out[c];
  }

  // cols
  const colBuf = new Float64Array(rows);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) colBuf[r] = mat[r * cols + c];
    const out = idctCol(colBuf);
    for (let r = 0; r < rows; r++) mat[r * cols + c] = out[r];
  }
  return mat;
}
