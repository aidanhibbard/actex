import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { StepDef } from '../../interfaces/step-def'
import type { StepPublic } from '../../interfaces/step-public'
import { Step } from '../../classes/step'
import { createStepSurface } from './run-step'

export const createStepService = <
  TInputSchema extends StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1,
  TProvide extends Record<string, unknown> = Record<string, unknown>,
>(
  def: StepDef<TInputSchema, TOutputSchema, TProvide>,
): StepPublic<
  StandardSchemaV1.InferOutput<TInputSchema>,
  StandardSchemaV1.InferOutput<TOutputSchema>,
  TProvide
> => createStepSurface(Step.create(def))
