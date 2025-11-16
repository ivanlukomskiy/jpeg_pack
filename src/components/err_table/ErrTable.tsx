import {useMemo} from "react";
import {getColorCss, getTextColor2} from "../../color_utils.tsx";


interface Props {
    errByName: Record<string, number>;
}

export function ErrTable({errByName}: Props) {
    return useMemo(() => {
        return (
            <table style={{ borderCollapse: 'collapse', fontSize: '10px' }}>
                <tbody>
                {Object.keys(errByName).map((key) => (
                    <tr key={key}
                        style={{
                            border: '1px solid #ddd',
                            padding: '2px',
                            textAlign: 'center',
                        }}>
                        <td
                            // title={`[${rowIndex},${colIndex}]: ${value}`}
                        >
                            {key}
                        </td>
                        <td
                            style={{
                                backgroundColor: getColorCss(errByName[key], -.5, .5),
                                color: getTextColor2(getColorCss(errByName[key], -.5, .5))
                            }}
                        >
                            {(errByName[key] * 100).toFixed(2)}%
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        )
    }, [errByName])
}
