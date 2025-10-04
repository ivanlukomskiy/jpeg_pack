import { useCallback, useRef, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { useOpenCV } from './hooks/opencv'



function App() {
  const [count, setCount] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cvLib = useOpenCV();

  const go = useCallback(() => {
    const cv = cvLib.cv;
    const src = new cv.Mat(8, 8, cv.CV_8UC1);
    for (let i = 0; i < src.rows; i++) {
        for (let j = 0; j < src.cols; j++) {
            src.ucharPtr(i, j)[0] = Math.floor(Math.random() * 256);
        }
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    displayImage(src, canvas);

  }, [cvLib])

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={go}>
          count is {count}
        </button>
        <canvas ref={canvasRef} width={100} height={100}></canvas>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
