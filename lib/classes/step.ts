import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { StepDef } from '../interfaces/step-def'
import type { ProcessFn, RollbackFn } from '../interfaces/process-fn'
import { createStepSurface, runStepService } from '../services/step/run-step'

export class Step<
  TInputSchema extends StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1,
  TProvide extends Record<string, unknown> = Record<string, unknown>,
> {
  public readonly name: string
  public readonly input: TInputSchema
  public readonly output: TOutputSchema
  public readonly defaultProvide: Partial<TProvide> | undefined
  public readonly process: ProcessFn<
    StandardSchemaV1.InferOutput<TInputSchema>,
    StandardSchemaV1.InferOutput<TOutputSchema>,
    TProvide
  >
  public readonly rollback:
    | RollbackFn<
        StandardSchemaV1.InferOutput<TInputSchema>,
        StandardSchemaV1.InferOutput<TOutputSchema>,
        TProvide
      >
    | undefined

  public readonly run = (
    input: StandardSchemaV1.InferOutput<TInputSchema>,
    options?: Parameters<
      typeof runStepService<TInputSchema, TOutputSchema, TProvide>
    >[2],
  ) => runStepService(this, input, options)

  private constructor(def: StepDef<TInputSchema, TOutputSchema, TProvide>) {
    this.name = def.name ?? 'step'
    this.input = def.input
    this.output = def.output
    this.defaultProvide = def.defaultProvide
    this.process = def.process
    this.rollback = def.rollback
  }

  public static create = <
    TInputSchema extends StandardSchemaV1,
    TOutputSchema extends StandardSchemaV1,
    TProvide extends Record<string, unknown> = Record<string, unknown>,
  >(
    def: StepDef<TInputSchema, TOutputSchema, TProvide>,
  ): Step<TInputSchema, TOutputSchema, TProvide> => new Step(def)

  public toSurface = () => createStepSurface(this)
}
