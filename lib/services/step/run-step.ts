import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { StepPublic } from '../../interfaces/step-public'
import type { Result } from '../../types/result'
import type { StepRunOptions } from '../../types/step-run-options'
import { Step } from '../../classes/step'
import {
  StepFailSignal,
  StepSkipAllSignal,
  StepSkipSignal,
} from '../../classes/step-signals'
import { ValidationError } from '../../classes/validation-error'
import type { FailOptions } from '../../interfaces/process-context'
import { mergeProvide } from '../../utils/merge-provide'
import { parse } from '../../utils/parse'
import { toActexError } from '../../utils/to-actex-error'

export const runStepService = async <
  TInputSchema extends StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1,
  TProvide extends Record<string, unknown>,
>(
  step: Step<TInputSchema, TOutputSchema, TProvide>,
  input: StandardSchemaV1.InferOutput<TInputSchema>,
  options?: StepRunOptions<TProvide>,
): Promise<
  Result<
    StandardSchemaV1.InferOutput<TInputSchema> &
      StandardSchemaV1.InferOutput<TOutputSchema>
  >
> => {
  type Input = StandardSchemaV1.InferOutput<TInputSchema>
  type Output = StandardSchemaV1.InferOutput<TOutputSchema>

  const data = parse(step.input, input)
  const provide = mergeProvide<TProvide>(step.defaultProvide, options?.provide)
  const ctx = {
    data: Object.freeze({
      ...(data as Record<string, unknown>),
    }) as Readonly<Input>,
  }

  const fail = (message: string, failOptions?: FailOptions): never => {
    throw new StepFailSignal(message, failOptions)
  }

  const skip = (message?: string): never => {
    throw new StepSkipSignal(message)
  }

  const skipAll = (message?: string): never => {
    throw new StepSkipAllSignal(message)
  }

  try {
    const rawOutput = await step.process({
      ctx,
      provide,
      fail,
      skip,
      skipAll,
    })
    const output = parse(step.output, rawOutput)
    const context = {
      ...(data as Record<string, unknown>),
      ...(output as Record<string, unknown>),
    } as Input & Output

    return {
      status: 'success',
      context,
      last: output,
    }
  } catch (error: unknown) {
    if (error instanceof StepSkipSignal || error instanceof StepSkipAllSignal) {
      const reason =
        error.message === 'skipped' || error.message === 'skipped all'
          ? undefined
          : error.message

      return {
        status: 'success',
        context: data as Input & Output,
        last: undefined,
        ...(reason !== undefined ? { reason } : {}),
        step: step.name,
      }
    }

    if (error instanceof StepFailSignal) {
      let rolledBack = false

      if (error.options?.rollback) {
        await error.options.rollback()
        rolledBack = true
      }

      return {
        status: 'failed',
        context: data as Input & Output,
        error: toActexError(error),
        rolledBack,
      }
    }

    if (error instanceof ValidationError) {
      throw error
    }

    let rolledBack = false
    if (step.rollback) {
      await step.rollback({ ctx, output: undefined, provide })
      rolledBack = true
    }

    return {
      status: 'failed',
      context: data as Input & Output,
      error: toActexError(error),
      rolledBack,
    }
  }
}

export const createStepSurface = <
  TInputSchema extends StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1,
  TProvide extends Record<string, unknown>,
>(
  step: Step<TInputSchema, TOutputSchema, TProvide>,
): StepPublic<
  StandardSchemaV1.InferOutput<TInputSchema>,
  StandardSchemaV1.InferOutput<TOutputSchema>,
  TProvide
> => ({
  name: step.name,
  input: step.input,
  output: step.output,
  process: async (context) => step.process(context),
  ...(step.rollback !== undefined ? { rollback: step.rollback } : {}),
  run: (input, options) => runStepService(step, input, options),
})
