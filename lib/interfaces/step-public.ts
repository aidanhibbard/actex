import type { StepHandle } from './step-handle'
import type { StepSurface } from './step-surface'

export type StepPublic<
  TInput = unknown,
  TOutput = unknown,
  TProvide extends Record<string, unknown> = Record<string, unknown>,
> = StepSurface<TInput, TOutput, TProvide> &
  StepHandle<TInput, TOutput, TProvide>
