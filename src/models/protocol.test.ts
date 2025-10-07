import { expect, test } from 'vitest'
import { kek } from '../processing/reed_solomon/adapter'

test('test kek', () => {
  const res = kek();
  expect(1).toBe(1)
})
