import { describe, expect, it } from 'vitest'

import { ActexError } from '../../../lib/utils/actex-error'

describe('ActexError', () => {
  it('sets name, message, and default code', () => {
    const error = new ActexError('something went wrong')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ActexError)
    expect(error.name).toBe('ActexError')
    expect(error.message).toBe('something went wrong')
    expect(error.code).toBe('ACTEX_ERROR')
  })

  it('accepts a custom code', () => {
    const error = new ActexError('step failed', 'STEP_FAILED')

    expect(error.code).toBe('STEP_FAILED')
  })
})
