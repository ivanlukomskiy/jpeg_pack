import { expect, test } from 'vitest'
import { BitsIteratorImpl } from './bits_iter'

test('test bits iter', () => {
  const iter = BitsIteratorImpl.fromBitString("10001000")
  expect(iter.next()).toBe(1)
  expect(iter.next()).toBe(0)
  expect(iter.next()).toBe(0)
  expect(iter.next()).toBe(0)
  expect(iter.next()).toBe(1)
  expect(iter.next()).toBe(0)
  expect(iter.next()).toBe(0)
  expect(iter.next()).toBe(0)
  expect(iter.next()).toBe(null)
})

test('test random bits iter', () => {
  const iter = BitsIteratorImpl.fromBitString("10001000")
  for (let i = 0; i < 8; i++) expect(iter.next()).satisfies((v: number) => v==1 || v==0)
  expect(iter.next()).toBe(null)
})

test('test read N', () => {
  const iter = BitsIteratorImpl.fromBitString("11111111")
  expect(iter.nextN(3)).toBe(7)
  expect(iter.nextN(1)).toBe(1)
  expect(iter.nextN(4)).toBe(15)
  expect(iter.next()).toBe(null)
})
