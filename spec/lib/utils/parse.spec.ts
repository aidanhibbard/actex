import type { StandardSchemaV1 } from '@standard-schema/spec'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { parse } from '../../../lib/utils/parse'
import { ValidationError } from '../../../lib/utils/validation-error'

const createSyncSchema = <T>(
  validate: StandardSchemaV1<unknown, T>['~standard']['validate'],
): StandardSchemaV1<unknown, T> => ({
  '~standard': {
    version: 1,
    vendor: 'test',
    validate,
  },
})

describe('parse', () => {
  it('returns validated value for sync success', () => {
    const schema = z.object({ orderId: z.string() })

    expect(parse(schema, { orderId: 'ord_123' })).toEqual({
      orderId: 'ord_123',
    })
  })

  it('throws ValidationError when sync validation fails', () => {
    const schema = z.object({ orderId: z.string() })

    expect(() => parse(schema, { orderId: 123 })).toThrow(ValidationError)
  })

  it('throws when validation returns a Promise', () => {
    const schema = createSyncSchema(() =>
      Promise.resolve({ value: 'async' as const }),
    )

    expect(() => parse(schema, 'input')).toThrow(
      'actex requires sync validation',
    )
  })
})
