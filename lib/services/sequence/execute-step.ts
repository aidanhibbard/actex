import type { EventBus } from '../../classes/event-bus'
import type { StepHandle } from '../../interfaces/step-handle'

type AnyStep = StepHandle
import { ValidationError } from '../../classes/validation-error'
import {
  StepAbortSignal,
  StepFailSignal,
  StepSkipAllSignal,
  StepSkipSignal,
} from '../../classes/step-signals'
import type { FailOptions } from '../../interfaces/process-context'
import { mergeStore } from '../../utils/merge-store'
import { parse } from '../../utils/parse'
import { toActexError } from '../../utils/to-actex-error'
import { buildPluginPayload, buildStepMeta } from './build-plugin-payload'
import type { CompletedStepRecord } from './rollback'

export type StepExecutionOutcome =
  | {
      readonly kind: 'success'
      readonly output: unknown
      readonly input: unknown
      readonly record: CompletedStepRecord
    }
  | {
      readonly kind: 'skip' | 'skipAll'
      readonly message: string
      readonly stepName: string
    }
  | {
      readonly kind: 'fail'
      readonly message: string
      readonly stepName: string
      readonly inlineRollback?: () => Promise<void>
    }

export const executeStep = async (
  bus: EventBus,
  handle: AnyStep,
  store: unknown,
  provide: Record<string, unknown>,
): Promise<StepExecutionOutcome> => {
  const input = parse(handle.input, store)

  await bus.dispatch(
    'step:before',
    buildPluginPayload({
      ctxData: input,
      store,
      provide,
      meta: buildStepMeta(handle),
    }),
  )

  try {
    const output = await runProcess(handle, input, provide)
    const mergedStore = mergeStore(
      input as Record<string, unknown>,
      output as Record<string, unknown>,
    )

    await bus.dispatch(
      'step:after',
      buildPluginPayload({
        ctxData: input,
        store: mergedStore,
        provide,
        meta: buildStepMeta(handle),
      }),
    )

    return {
      kind: 'success',
      output,
      input,
      record: { handle, input, output },
    }
  } catch (error) {
    return mapStepError(bus, handle, store, provide, input, error)
  }
}

const runProcess = async (
  handle: AnyStep,
  input: unknown,
  provide: Record<string, unknown>,
): Promise<unknown> => {
  const fail = (message: string, options?: FailOptions): never => {
    throw new StepFailSignal(message, options)
  }
  const skip = (message?: string): never => {
    throw new StepSkipSignal(message)
  }
  const skipAll = (message?: string): never => {
    throw new StepSkipAllSignal(message)
  }

  const rawOutput = await handle.process({
    ctx: { data: Object.freeze({ ...(input as object) }) },
    provide: provide,
    fail,
    skip,
    skipAll,
  })

  return parse(handle.output, rawOutput)
}

const mapStepError = async (
  bus: EventBus,
  handle: AnyStep,
  store: unknown,
  provide: Record<string, unknown>,
  input: unknown,
  error: unknown,
): Promise<StepExecutionOutcome> => {
  if (error instanceof StepSkipSignal || error instanceof StepSkipAllSignal) {
    await bus.dispatch(
      'step:skip',
      buildPluginPayload({
        ctxData: input,
        store,
        provide,
        meta: {
          step: { name: handle.name },
          ...(error.message !== 'skipped' && error.message !== 'skipped all'
            ? { reason: error.message }
            : {}),
        },
      }),
    )
    return {
      kind: error instanceof StepSkipAllSignal ? 'skipAll' : 'skip',
      message: error.message,
      stepName: handle.name,
    }
  }

  if (error instanceof StepFailSignal || error instanceof StepAbortSignal) {
    await bus.dispatch(
      'step:fail',
      buildPluginPayload({
        ctxData: input,
        store,
        provide,
        meta: { step: { name: handle.name }, error: toActexError(error) },
      }),
    )
    return {
      kind: 'fail',
      message: error.message,
      stepName: handle.name,
      ...(error instanceof StepFailSignal &&
      error.options?.rollback !== undefined
        ? { inlineRollback: error.options.rollback }
        : {}),
    }
  }

  if (error instanceof ValidationError) {
    throw error
  }

  await bus.dispatch(
    'step:fail',
    buildPluginPayload({
      ctxData: input,
      store,
      provide,
      meta: { step: { name: handle.name }, error: toActexError(error) },
    }),
  )

  await bus.dispatch(
    'sequence:error',
    buildPluginPayload({
      ctxData: input,
      store,
      provide,
      meta: { error: toActexError(error), step: { name: handle.name } },
    }),
  )

  throw error
}
