import { getOpenCv } from '../hooks/opencv.ts';
import { DefaultEncodingConf } from '../processing/config.ts';
import { decodeFile } from '../models/protocol.ts';
import { deserializeMat, serializeMat } from '../processing/utils.ts';
import { DecoderImpl } from '../processing/decoder.ts';
import {
  createDecodingProgressTracker,
  DecodingStep,
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

  if (type !== 'start') {
    self.postMessage({
      type: 'error',
      data: 'unsupported message',
    });
    return;
  }

  const { bgrf32, trackerState } = data;
  const tracker = createDecodingProgressTracker(trackerState);
  try {
    reportStarted(DecodingStep.LOAD_OPENCV, tracker);
    const cvModule = await getOpenCv();
    console.log('cvModule', cvModule.cv);
    const cv = cvModule.cv;
    const bgr32fDecoded = deserializeMat(bgrf32, cv);
    reportDone(tracker);

    const decoder = new DecoderImpl(cv, DefaultEncodingConf);
    const decoded = decoder.decode(bgr32fDecoded, false, (step: number, state: number) => {
      if (state === StepStatusCode.IN_PROGRESS) {
        reportStarted(step, tracker);
      } else if (state === StepStatusCode.COMPLETED) {
        reportDone(tracker);
      }
    });

    reportStarted(DecodingStep.DECODE_FILE, tracker);
    const res = await decodeFile(decoded);
    const serialized = serializeMat(bgr32fDecoded);
    reportDone(tracker);

    self.postMessage({
      type: 'result',
      data: {
        filename: res.filename,
        data: res.data,
        bgr32f: serialized,
      },
    });
  } catch (error) {
    reportFailed(error as Error, tracker);
  }
};
