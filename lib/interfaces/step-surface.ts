import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { Result } from '../types/result'
import type { StepRunOptions } from '../types/step-run-options'

export interface StepSurface<TInput, TOutput, TProvide> {
  readonly name: string
  readonly input: StandardSchemaV1<unknown, TInput>
  readonly output: StandardSchemaV1<unknown, TOutput>
  readonly run: (
    input: TInput,
    options?: StepRunOptions<TProvide>,
  ) => Promise<Result<TInput & TOutput>>
}
