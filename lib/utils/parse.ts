import type { StandardSchemaV1 } from '@standard-schema/spec'

import { ValidationError } from './validation-error'

export const parse = <T>(
  schema: StandardSchemaV1<unknown, T>,
  value: unknown,
): T => {
  const result = schema['~standard'].validate(value)
  if (result instanceof Promise) {
    throw new TypeError('actex requires sync validation')
  }
  if (result.issues) {
    throw new ValidationError(result.issues)
  }
  return result.value
}
