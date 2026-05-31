import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { StepDef } from './interfaces/step-def'
import type { StepDefinition } from './interfaces/step-definition'
import type { StepPublic } from './interfaces/step-public'
import { createStepService } from './services/step'

const stepFactory = createStepService

export const step = stepFactory as {
  <
    TInputSchema extends StandardSchemaV1,
    TOutputSchema extends StandardSchemaV1,
    TProvide extends Record<string, unknown> = Record<string, unknown>,
  >(
    def: StepDef<TInputSchema, TOutputSchema, TProvide>,
  ): StepPublic<
    StandardSchemaV1.InferOutput<TInputSchema>,
    StandardSchemaV1.InferOutput<TOutputSchema>,
    TProvide
  >
  <
    TInput,
    TOutput,
    TProvide extends Record<string, unknown> = Record<string, unknown>,
  >(
    def: StepDefinition<TInput, TOutput, TProvide>,
  ): StepPublic<TInput, TOutput, TProvide>
}

export type { StepSurface } from './interfaces/step-surface'
