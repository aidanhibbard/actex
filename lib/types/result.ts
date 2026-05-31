import type { ActexError } from './actex-error'

export type Result<TContext> =
  | {
      readonly status: 'success'
      readonly context: TContext
      readonly last: unknown
      readonly reason?: string
      readonly step?: string
    }
  | {
      readonly status: 'failed'
      readonly context: TContext
      readonly error: ActexError
      readonly rolledBack: boolean
    }
  | {
      readonly status: 'running'
      readonly context: TContext
      readonly step?: string
    }
