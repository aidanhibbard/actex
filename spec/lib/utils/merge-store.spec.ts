import { describe, expect, it } from 'vitest'

import { mergeStore } from '../../../lib/utils/merge-store'

describe('mergeStore', () => {
  it('merges object outputs into the input record', () => {
    expect(mergeStore({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
  })

  it('spreads non-object outputs onto the input record', () => {
    expect(mergeStore({ a: 1 }, 'value' as never)).toEqual({
      a: 1,
      0: 'v',
      1: 'a',
      2: 'l',
      3: 'u',
      4: 'e',
    })
  })
})
