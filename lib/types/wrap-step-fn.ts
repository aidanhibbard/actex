import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { StepDef } from '../interfaces/step-def'

export type WrapStepControls = {
  readonly abort: (reason: string) => never
}

export type WrapStepFn = <
  TInputSchema extends StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1,
  TProvide extends Record<string, unknown> = Record<string, unknown>,
>(
  stepDef: StepDef<TInputSchema, TOutputSchema, TProvide>,
  controls: WrapStepControls,
) => StepDef<TInputSchema, TOutputSchema, TProvide>
