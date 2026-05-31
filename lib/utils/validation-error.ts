import type { StandardSchemaV1 } from '@standard-schema/spec'

import { ActexError } from './actex-error'

export class ValidationError extends ActexError {
  public readonly issues: readonly StandardSchemaV1.Issue[]

  public constructor(issues: readonly StandardSchemaV1.Issue[]) {
    const message =
      issues.map((issue) => issue.message).join('; ') || 'Validation failed'
    super(message, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
    this.issues = issues
  }
}
