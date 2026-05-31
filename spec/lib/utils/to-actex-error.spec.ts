import { describe, expect, it } from 'vitest'

import { toActexError } from '../../../lib/utils/to-actex-error'

describe('toActexError', () => {
  it('returns structured errors when code and message are present', () => {
    expect(toActexError({ code: 'X', message: 'failed' })).toEqual({
      code: 'X',
      message: 'failed',
      cause: undefined,
    })
  })

  it('wraps Error instances', () => {
    const cause = new Error('boom')
    expect(toActexError(cause)).toEqual({
      code: 'STEP_ERROR',
      message: 'boom',
      cause,
    })
  })

  it('wraps unknown non-error values', () => {
    expect(toActexError('oops')).toEqual({
      code: 'STEP_ERROR',
      message: 'Unknown step error',
      cause: 'oops',
    })
  })
})
