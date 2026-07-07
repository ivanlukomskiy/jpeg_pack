import { Button, FileButton, Flex, Loader, Text, Title } from '@mantine/core';
import { useCallback, useState } from 'react';
import { useOpenCV } from '../../hooks/opencv';
import { calibrateBgr32f } from '../../processing/calibration';
import { decodeJpeg, downloadFile, fileToUint8Array, matToJpegFileResult } from '../../processing/utils.ts';

function calibratedFilename(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return `${name}_calibrated.jpeg`;
  return `${name.slice(0, dot)}_calibrated${name.slice(dot)}`;
}

export function Calibrate() {
  const cvLib = useOpenCV();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<string | null>(null);
  const [correction, setCorrection] = useState<{ scale: number; offset: number } | null>(null);

  const calibrate = useCallback(
    async (file: File) => {
      if (!cvLib.cv) return;
      setLoading(true);
      setError(null);
      setCorrection(null);
      setLastFile(file.name);

      let bgr32f: any = null;
      let calibrated: any = null;
      try {
        const raw = await fileToUint8Array(file);
        const decoded = await decodeJpeg(cvLib.cv, raw);
        bgr32f = decoded.bgr32fDecoded;

        const result = calibrateBgr32f(cvLib.cv, bgr32f);
        calibrated = result.bgr32f;
        setCorrection({ scale: result.scale, offset: result.offset });

        const outName = calibratedFilename(file.name);
        const jpeg = await matToJpegFileResult(calibrated, outName, 0.95);
        downloadFile(jpeg.filename, jpeg.data);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        bgr32f?.delete();
        calibrated?.delete();
        setLoading(false);
      }
    },
    [cvLib.cv],
  );

  return (
    <Flex direction="column" gap="md" align="center" style={{ padding: '20px' }}>
      <Title size="lg">Calibrate</Title>
      <Text size="sm" c="dimmed" maw={400} ta="center">
        Upload a jpeg_pack image to correct brightness using the calibration blocks in the top-left corner.
      </Text>

      {cvLib.isLoading && <Loader size="sm" />}
      {cvLib.error && (
        <Text c="red" size="sm">
          {cvLib.error}
        </Text>
      )}

      <FileButton onChange={f => f && calibrate(f)} accept="image/png,image/jpeg" disabled={!cvLib.cv || loading}>
        {props => (
          <Button {...props} loading={loading}>
            Upload image
          </Button>
        )}
      </FileButton>

      {lastFile && !error && (
        <Text size="sm" c="green">
          Calibrated and downloaded: {calibratedFilename(lastFile)}
        </Text>
      )}

      {correction && (
        <Text size="sm" c="dimmed">
          scale={correction.scale.toFixed(4)}, offset={correction.offset.toFixed(4)}
        </Text>
      )}

      {error && (
        <Text c="red" size="sm">
          {error}
        </Text>
      )}
    </Flex>
  );
}
