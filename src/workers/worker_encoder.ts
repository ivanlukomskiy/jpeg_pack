import { getOpenCv } from '../hooks/opencv.ts';
import { EncoderImpl } from '../processing/encoder.ts';
import { DefaultEncodingConf } from '../processing/config.ts';
import { BitsIteratorImpl } from '../processing/bits_iter.ts';
import { encodeFile, getFullByteCapacity } from '../models/protocol.ts';
import { fileToUint8Array, serializeMat } from '../processing/utils.ts';
import {
  createEncodingProgressTracker,
  EncodingStep,
  ProgressTracker,
  StepStatusCode,
} from '../processing/progress.ts';

function reportStarted(step: number, tracker: ProgressTracker) {
  tracker.markInProgress(step);
  self.postMessage({ type: 'progress', data: tracker.serialize() });
}
function reportDone(tracker: ProgressTracker) {
  tracker.markCurrentStepCompleted();
  self.postMessage({ type: 'progress', data: tracker.serialize() });
}
function reportFailed(e: Error, tracker: ProgressTracker) {
  tracker.markCurrentStepFailed(e.message);
  self.postMessage({ type: 'progress', data: tracker.serialize() });
}

self.onmessage = async function (event) {
  const { type, data } = event.data;
  const tracker = createEncodingProgressTracker();

  if (type === 'start') {
    try {
      reportStarted(EncodingStep.LOAD_OPENCV, tracker);
      const cvModule = await getOpenCv();
      const cv = cvModule.cv;
      reportDone(tracker);

      reportStarted(EncodingStep.LOAD_FILE, tracker);
      const { w, h, encFile } = data;
      const fileRawData = await fileToUint8Array(encFile);
      reportDone(tracker);

      reportStarted(EncodingStep.PREPARE_FILE, tracker);
      const rsByteCapacity = getFullByteCapacity(w, h);
      const encodedFileData = await encodeFile(encFile.name, fileRawData, rsByteCapacity);
      const iterator = BitsIteratorImpl.fromBytes(encodedFileData);

      const encoder = new EncoderImpl(cv, w, h, iterator, DefaultEncodingConf);
      reportDone(tracker);

      const bgr32f = await encoder.encode(false, (step: number, state: number) => {
        if (state === StepStatusCode.IN_PROGRESS) {
          reportStarted(step, tracker);
        } else if (state === StepStatusCode.COMPLETED) {
          reportDone(tracker);
        }
      });
      console.log('bgr32f', bgr32f);
      const serialized = serializeMat(bgr32f);
      self.postMessage({
        type: 'result',
        data: serialized,
      });
    } catch (error) {
      reportFailed(error as Error, tracker);
    }
  }
};
