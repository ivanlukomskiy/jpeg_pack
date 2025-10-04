import { useState, useEffect } from 'react';

declare global {
  interface Window {
    cv: any;
  }
}

export const useOpenCV = () => {
  const [cv, setCv] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOpenCV = () => {
      if (window.cv) {
        setCv(window.cv);
        setIsLoading(false);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://docs.opencv.org/4.12.0/opencv.js';
      script.async = true;
      script.onload = () => {
        // OpenCV.js loads asynchronously, we need to wait for it to be ready
        (window as any).cv['onRuntimeInitialized'] = () => {
          setCv(window.cv);
          setIsLoading(false);
        };
      };
      script.onerror = () => {
        setError('Failed to load OpenCV.js');
        setIsLoading(false);
      };

      document.head.appendChild(script);
    };

    loadOpenCV();
  }, []);

  return { cv, isLoading, error };
};