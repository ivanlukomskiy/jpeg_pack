import { expect, test } from 'vitest'
import { decodeFile, encodeFile } from './protocol'

test('test file re-encoding', async () => {
  const data = new Uint8Array([111, 23, 13, 42, 25, 12, 11]);
  const filename = "cats.pic";
  const encoded = await encodeFile(filename, data)
  const [decodedFilename, decodedData] = await decodeFile(encoded);
  expect(decodedFilename).toBe(filename)
  expect(data.length).toBe(decodedData.length)
  for (let i = 0; i < data.length; i++) {
    expect(data[i]).toBe(decodedData[i])
  }
})
