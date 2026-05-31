import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { ProcessFn, RollbackFn } from './process-fn'

export interface StepDef<
  TInputSchema extends StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1,
  TProvide extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly name?: string | undefined
  readonly input: TInputSchema
  readonly output: TOutputSchema
  readonly defaultProvide?: Partial<TProvide>
  readonly rollback?: RollbackFn<
    StandardSchemaV1.InferOutput<TInputSchema>,
    StandardSchemaV1.InferOutput<TOutputSchema>,
    TProvide
  >
  readonly process: ProcessFn<
    StandardSchemaV1.InferOutput<TInputSchema>,
    StandardSchemaV1.InferOutput<TOutputSchema>,
    TProvide
  >
}
