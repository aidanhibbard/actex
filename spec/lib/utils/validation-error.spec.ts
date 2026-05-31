import { describe, expect, it } from 'vitest'

import { ActexError } from '../../../lib/utils/actex-error'
import { ValidationError } from '../../../lib/utils/validation-error'

describe('ValidationError', () => {
  it('extends ActexError with joined issue messages', () => {
    const error = new ValidationError([
      { message: 'orderId is required' },
      { message: 'invalid format', path: [{ key: 'orderId' }] },
    ])

    expect(error).toBeInstanceOf(ActexError)
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.name).toBe('ValidationError')
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.message).toBe('orderId is required; invalid format')
    expect(error.issues).toHaveLength(2)
  })

  it('uses a fallback message when issues are empty', () => {
    const error = new ValidationError([])

    expect(error.message).toBe('Validation failed')
    expect(error.issues).toEqual([])
  })
})
