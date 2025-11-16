const step = 0.05;
const min = 0;
const max = 1;

export interface ChannelStats {
    countByRange: Record<string, number>
    lowerBoundCount: number;
    upperBoundCount: number;
}

function createChannelStats(): ChannelStats {
    const countByRange: Record<number, number> = {};
    for (let v = min; v <= max; v += step) {
        countByRange[parseFloat((v + step/2).toFixed(2))] = 0;
    }
    return { countByRange, lowerBoundCount: 0, upperBoundCount: 0 };
}

export function analyzeF32Matrix(acc: Record<string, ChannelStats>, mat: any, ycrcb: boolean) {
    const rows = mat.rows;
    const cols = mat.cols;
    const channels = mat.channels();
    const channelKeys = ycrcb ? ['Y', 'Cr', 'Cb'] : ['B', 'G', 'R'];

    for (let chIdx = 0; chIdx < channels; chIdx++) {
        const key = channelKeys[chIdx] || `C${chIdx}`;
        let stats = acc[key];
        if (!stats) {
            stats = createChannelStats();
            acc[key] = stats;
        }

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const pixel = mat.floatPtr(i, j)[chIdx];

                if (pixel <= min) {
                    stats.lowerBoundCount++;
                } else if (pixel >= max) {
                    stats.upperBoundCount++;
                } else {
                    // fixme that's really slow
                    for (let v = min; v <= max; v += step) {
                        const mid = parseFloat((v + step / 2).toFixed(2));
                        if (pixel <= v + step) {
                            stats.countByRange[mid]++;
                            break;
                        }
                    }
                }
            }
        }
    }
}