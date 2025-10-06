import { useCallback, useEffect, useRef } from "react";


function displayImage(mat: any, canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("No canvas context")

    let imageData;
    
    if (mat.channels() === 1) {
        // Grayscale image
        imageData = ctx.createImageData(mat.cols, mat.rows);
        const data = imageData.data;
        const matData = mat.data;
        
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            const pixel = matData[j];
            data[i] = pixel;     // R
            data[i + 1] = pixel; // G
            data[i + 2] = pixel; // B
            data[i + 3] = 255;   // A (fully opaque)
        }
    } else if (mat.channels() === 3) {
        // console.log('BGR')
        // BGR
        imageData = ctx.createImageData(mat.cols, mat.rows);
        const data = imageData.data;
        const matData = mat.data;
        
        for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
            data[i] = matData[j + 2];     // R (BGR -> RGB)
            data[i + 1] = matData[j + 1]; // G
            data[i + 2] = matData[j];     // B
            data[i + 3] = 255;           // A
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


function downloadMatAsJpeg(mat, filename = 'image.jpg') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = mat.cols;
    canvas.height = mat.rows;
    const imageData = ctx.createImageData(mat.cols, mat.rows);
    const matData = new Uint8ClampedArray(mat.data);
    const imageDataData = imageData.data;
    for (let i = 0, j = 0; i < matData.length; i += 3, j += 4) {
        imageDataData[j] = matData[i];     // R
        imageDataData[j + 1] = matData[i + 1]; // G
        imageDataData[j + 2] = matData[i + 2]; // B
        imageDataData[j + 3] = 255;        // A
    }
    ctx.putImageData(imageData, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


interface Props {
    mat: any;
}

export function MatRender({mat}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

    const download = useCallback(() => {
      if (!mat) return;
      downloadMatAsJpeg(mat);
    }, [mat])

    useEffect(() => {
        if (!mat || !canvasRef.current) return;
        displayImage(mat, canvasRef.current)
    }, [mat])
  
    return (
        <div style={{width: '100%'}}>
            <canvas ref={canvasRef} width={240} height={240} onClick={download} style={{cursor: mat ? 'pointer' : undefined }}></canvas>
        </div>
    )
}