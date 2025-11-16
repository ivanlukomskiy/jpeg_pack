import { useEffect, useRef } from 'react';

function displayImage(mat: any, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas context');

  let imageData;

  if (mat.channels() === 1) {
    // Grayscale image
    imageData = ctx.createImageData(mat.cols, mat.rows);
    const data = imageData.data;
    const matData = mat.data;

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const pixel = matData[j];
      data[i] = pixel; // R
      data[i + 1] = pixel; // G
      data[i + 2] = pixel; // B
      data[i + 3] = 255; // A (fully opaque)
    }
  } else if (mat.channels() === 3) {
    console.log('BGR');
    // BGR
    imageData = ctx.createImageData(mat.cols, mat.rows);
    const data = imageData.data;
    const matData = mat.data32F; // <-- use float data

    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      // Scale [0,1] float to [0,255] for display
      const b = Math.min(255, Math.max(0, matData[j] * 255));
      const g = Math.min(255, Math.max(0, matData[j + 1] * 255));
      const r = Math.min(255, Math.max(0, matData[j + 2] * 255));

      data[i] = r; // R (BGR -> RGB)
      data[i + 1] = g; // G
      data[i + 2] = b; // B
      data[i + 3] = 255; // A
    }
  } else if (mat.channels() === 4) {
    imageData = new ImageData(new Uint8ClampedArray(mat.data), mat.cols, mat.rows);
  } else {
    console.error('Unsupported number of channels:', mat.channels());
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = mat.cols;
  tempCanvas.height = mat.rows;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx!.putImageData(imageData, 0, 0);

  // Scale up for display
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tempCanvas, 0, 0, mat.cols, mat.rows, 0, 0, canvas.width, canvas.height);
}

interface Props {
  mat: any;
  size?: number;
}

export function MatRender({ mat, size = 240 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!mat || !canvasRef.current) return;
    displayImage(mat, canvasRef.current);
  }, [mat]);

  return (
    <div style={{ width: '100%' }}>
      <canvas ref={canvasRef} width={size} height={size} style={{ cursor: mat ? 'pointer' : undefined }}></canvas>
    </div>
  );
}
