import { useEffect, useState } from 'react';
import cvModule from '@techstark/opencv-js';

declare global {
  interface Window {
    cv: any;
  }
}

export async function getOpenCv() {
  let cv;
  if (cvModule instanceof Promise) {
    cv = await cvModule;
  } else {
    await new Promise<void>(resolve => {
      cvModule.onRuntimeInitialized = () => resolve();
    });
    cv = cvModule;
  }
  return { cv };
}

export const useOpenCV = () => {
  const [cv, setCv] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOpenCv()
      .then(cv => {
        setCv(cv.cv);
        setIsLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setIsLoading(false);
      });
  }, []);

  return { cv, isLoading, error };
};
