import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { ProcessContext } from './process-context'
import type { RollbackContext } from './step-handle'

export interface StepDefinition<
  TInput = unknown,
  TOutput = unknown,
  TProvide extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly name?: string | undefined
  readonly input: StandardSchemaV1<unknown, TInput>
  readonly output: StandardSchemaV1<unknown, TOutput>
  readonly defaultProvide?: Partial<TProvide> | undefined
  readonly rollback?: (
    context: RollbackContext<TInput, TOutput, TProvide>,
  ) => void | Promise<void>
  readonly process: (
    context: ProcessContext<TInput, TProvide>,
  ) => TOutput | Promise<TOutput>
}
