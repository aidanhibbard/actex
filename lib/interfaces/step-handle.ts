import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { ProcessContext } from './process-context'

export interface StepHandle<
  TInput = unknown,
  TOutput = unknown,
  TProvide extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly name: string
  readonly input: StandardSchemaV1<unknown, TInput>
  readonly output: StandardSchemaV1<unknown, TOutput>
  readonly process: (
    context: ProcessContext<TInput, TProvide>,
  ) => TOutput | Promise<TOutput>
  readonly rollback?: (
    context: RollbackContext<TInput, TOutput, TProvide>,
  ) => void | Promise<void>
}

export interface RollbackContext<
  TInput,
  TOutput,
  TProvide extends Record<string, unknown>,
> {
  readonly ctx: { readonly data: TInput }
  readonly output: TOutput | undefined
  readonly provide: TProvide
}
