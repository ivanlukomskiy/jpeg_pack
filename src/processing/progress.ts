export const EncodingStep = {
    LOAD_OPENCV: 1,
    LOAD_FILE: 2,
    PREPARE_FILE: 3,
    POPULATE_DCT: 4,
    INVERSE_DCT: 5,
    NORMALIZE: 6,
    CONVERT_TO_BGR: 7,
    CREATE_IMAGE: 8,
} as const;
export const EncodingStepDesc: Record<number, string> = {
    [EncodingStep.LOAD_OPENCV]: "Loading OpenCV",
    [EncodingStep.LOAD_FILE]: "Loading file",
    [EncodingStep.PREPARE_FILE]: "Encoding file",
    [EncodingStep.POPULATE_DCT]: "Populating DCT coefficients",
    [EncodingStep.INVERSE_DCT]: "Applying inverse DCT",
    [EncodingStep.NORMALIZE]: "Normalizing image",
    [EncodingStep.CONVERT_TO_BGR]: "Converting to BGR color space",
    [EncodingStep.CREATE_IMAGE]: "Creating image",
}

export const DecodingStep = {
    NOT_STARTED: 0,
    LOAD_OPENCV: 1,
    LOAD_IMAGE: 2,
    CONVERT_TO_YCRCB: 3,
    EXTRACT_CHANNELS: 4,
    DCT: 5,
    EXTRACT_BITS: 6,
    DONE: 7,
}

export const DecodingStepDesc: Record<number, string> = {
    [DecodingStep.NOT_STARTED]: "Not started",
    [DecodingStep.LOAD_OPENCV]: "Loading OpenCV",
    [DecodingStep.LOAD_IMAGE]: "Loading image",
    [DecodingStep.CONVERT_TO_YCRCB]: "Converting to YCrCb color space",
    [DecodingStep.EXTRACT_CHANNELS]: "Extracting channels",
    [DecodingStep.DCT]: "Applying DCT",
    [DecodingStep.EXTRACT_BITS]: "Extracting bits from DCT coefficients",
    [DecodingStep.DONE]: "Done",
}

export const StepStatusCode = {
    PENDING: 0,
    IN_PROGRESS: 1,
    COMPLETED: 2,
    FAILED: 3,
}

export interface StepStatus {
    code: number;
    error?: string;
    startTime?: number;
    endTime?: number;
}

export class ProgressTracker {
    private status: Map<number, StepStatus>
    private readonly describe: (step: number) => string

    constructor(steps: readonly number[], describe: (step: number) => string) {
        this.status = new Map()
        this.describe = describe

        for (const step of steps) {
            this.status.set(step, { code: StepStatusCode.PENDING } )
        }
    }

    public markInProgress(step: number) {
        console.log(`${this.describe(step)} started`)
        this.status.set(step, { code: StepStatusCode.IN_PROGRESS, startTime: Date.now() } )
    }
    public markCurrentStepCompleted() {
        const currentStep = Array.from(this.status.entries()).find(([, status]) => status.code === StepStatusCode.IN_PROGRESS)
        if (currentStep) {
            const state = currentStep[1];
            state.code = StepStatusCode.COMPLETED
            state.endTime = Date.now()
            console.log(`${this.describe(currentStep[0])} completed in ${state.endTime! - state.startTime!} ms`)
            // this.status.set(currentStep[0], state )
        } else {
            console.error('No step is currently in progress to mark as completed')
        }
    }
    public markCurrentStepFailed(error: string) {
        const currentStep = Array.from(this.status.entries()).find(([, status]) => status.code === StepStatusCode.IN_PROGRESS)
        if (currentStep) {
            const state = currentStep[1];
            state.code = StepStatusCode.FAILED;
            state.endTime = Date.now();
            state.error = error;
            console.error(`${this.describe(currentStep[0])} failed with error in ${state.endTime! - state.startTime!} ms: ${error}`)
            // this.status.set(currentStep[0], { code: StepStatusCode.FAILED, error } )
        } else {
            console.error('No step is currently in progress to mark as failed')
            console.error(error)
        }
    }

    public serialize(): Record<number, StepStatus> {
        const out: Record<number, StepStatus> = {}
        for (const [step, status] of this.status.entries()) {
            out[step] = status
        }
        return out
    }
}

export function createEncodingProgressTracker() {
    const steps = Object.values(EncodingStep) as number[]
    return new ProgressTracker(steps, (step) => EncodingStepDesc[step])
}

export function createDecodingProgressTracker() {
    const steps = Object.values(DecodingStep) as number[]
    return new ProgressTracker(steps, (step) => DecodingStepDesc[step])
}
