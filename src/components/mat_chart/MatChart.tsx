import type {ChannelStats} from "../../processing/matrix_analysis.ts";
import {Flex, Typography} from "@mantine/core";
import {BarChart} from "@mantine/charts";
import {useMemo} from "react";

interface Props {
    chStats: Record<string, ChannelStats>;
}

interface Point {
    name: string;
    count: number;
    color: string;
}

export function MatChart({chStats}: Props) {
    const chartData: Record<string, Point[]> = useMemo(() => {
        const res: Record<string, Point[]> = {};
        Object.keys(chStats).forEach(chanName => {
            const chanPoints: Point[] = [];
            const stats = chStats[chanName];
            chanPoints.push({ name: '<=0', count: stats.lowerBoundCount, color: 'red'})
            Object.keys(stats.countByRange).forEach(range => {
                chanPoints.push({ name: range, count: stats.countByRange[range], color: 'green'})
            });
            chanPoints.push({ name: '>=1', count: stats.upperBoundCount, color: 'red'})
            res[chanName] = chanPoints;
        });
        return res;
    }, [chStats])

    return useMemo(() => (
        <Flex direction={'row'} style={{width:'100%', maxWidth: '1200px'}}>
            {Object.keys(chartData).map(chanName => (
                <Flex direction={'column'} key={chanName} style={{flexGrow: 1}}>
                {/*<Flex direction={'column'} key={chanName} style={{width: '300px'}}>*/}
                    <Typography>{chanName}</Typography>
                    <BarChart
                        h={100}
                        data={chartData[chanName]}
                        dataKey="name"
                        series={[
                            { name: 'count', color: 'violet.6' },
                        ]}
                        tickLine="y"
                    />
                    {/*<pre>{JSON.stringify(chartData[chanName])}</pre>*/}
                </Flex>
            ))}
        </Flex>
    ), [chartData]);
}