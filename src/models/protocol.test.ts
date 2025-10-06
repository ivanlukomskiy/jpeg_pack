import { expect, test } from 'vitest'
import { kek } from './protocol'

test('test kek', () => {
  const res = kek();
  expect(1).toBe(1)
})
