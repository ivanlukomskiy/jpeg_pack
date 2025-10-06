import { useMemo } from "react";


interface Props {
    mat: any;
}

const extractChannelData = (mat: any, channelIndex: number) => {
    const rows = mat.rows;
    const cols = mat.cols;
    const channelData = [];

    for (let i = 0; i < rows; i++) {
        const row = [];
        for (let j = 0; j < cols; j++) {
        // For multi-channel images, get the specific channel value
        const pixel = mat.ucharPtr(i, j);
        row.push(pixel[channelIndex]);
        }
        channelData.push(row);
    }

    return channelData;
};

export function Mat({mat}: Props) {
  return useMemo(() => {
    if (!mat) return <div>no image</div>
    const channels = [];

    // Extract data for each channel
    for (let c = 0; c < mat.channels(); c++) {
        channels.push(extractChannelData(mat, c));
    }

    return (
    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
      {channels.map((channel, channelIndex) => (
        <div key={channelIndex}>
          <h3>{channelIndex}</h3>
          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '10px' }}>
              <tbody>
                {channel.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((value, colIndex) => (
                      <td 
                        key={colIndex}
                        style={{
                          border: '1px solid #ddd',
                          padding: '2px',
                          textAlign: 'center',
                          backgroundColor: `rgba(${value}, ${value}, ${value}, 0.1)`
                        }}
                        title={`[${rowIndex},${colIndex}]: ${value}`}
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
  }, [mat])
}
