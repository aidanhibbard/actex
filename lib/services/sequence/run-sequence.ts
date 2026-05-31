import { EventBus } from '../../classes/event-bus'
import type { SequenceBuilderState } from '../../interfaces/sequence-builder-state'
import type { Result } from '../../types/result'
import { ValidationError } from '../../classes/validation-error'
import { mergeStore } from '../../utils/merge-store'
import { mergeProvide } from '../../utils/merge-provide'
import { parse } from '../../utils/parse'
import { toActexError } from '../../utils/to-actex-error'
import { buildPluginPayload } from './build-plugin-payload'
import { executeStep } from './execute-step'
import { rollbackCompletedSteps, type CompletedStepRecord } from './rollback'
import { wrapStepWithPlugins } from './wrap-step-with-plugins'

export const runSequence = async <TContext>(
  state: SequenceBuilderState,
  input: unknown,
): Promise<Result<TContext>> => {
  const bus = EventBus.create()
  const pluginMounts = state.plugins.map((plugin) => bus.mount(plugin))
  const listenerHandles = state.listeners.map((listener) =>
    bus.listen(listener.event, listener.handler, listener.options),
  )

  try {
    return await runSequenceWithBus(bus, state, input, pluginMounts)
  } finally {
    for (const mount of pluginMounts) {
      mount.unmount()
    }
    for (const handle of listenerHandles) {
      handle.unlisten()
    }
  }
}

const runSequenceWithBus = async <TContext>(
  bus: EventBus,
  state: SequenceBuilderState,
  input: unknown,
  pluginMounts: ReturnType<EventBus['mount']>[],
): Promise<Result<TContext>> => {
  const provide = mergeProvide(undefined, state.provide)

  const firstStep = state.steps[0]
  if (firstStep === undefined) {
    return {
      status: 'success',
      context: input as TContext,
      last: input,
    }
  }

  let store: unknown = parse(firstStep.input, input)

  await bus.dispatch(
    'sequence:start',
    buildPluginPayload({
      ctxData: undefined,
      store,
      provide,
      meta: { input },
    }),
  )

  const completed: CompletedStepRecord[] = []
  let lastOutput: unknown = store

  for (const stepHandle of state.steps) {
    const wrapped = wrapStepWithPlugins(stepHandle, pluginMounts)

    let outcome
    try {
      outcome = await executeStep(bus, wrapped, store, provide)
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }

      let rolledBack = await rollbackCompletedSteps(completed, provide)

      if (wrapped.rollback !== undefined) {
        await wrapped.rollback({
          ctx: { data: store },
          output: undefined,
          provide,
        })
        rolledBack = true
      }

      return {
        status: 'failed',
        context: store as TContext,
        error: toActexError(error),
        rolledBack,
      }
    }

    if (outcome.kind === 'success') {
      store = mergeStore(
        store as Record<string, unknown>,
        outcome.output as Record<string, unknown>,
      )
      completed.push(outcome.record)
      lastOutput = outcome.output
      continue
    }

    if (outcome.kind === 'skip' || outcome.kind === 'skipAll') {
      const successResult: Result<TContext> = {
        status: 'success',
        context: store as TContext,
        last: lastOutput,
        reason: outcome.message,
        step: outcome.stepName,
      }
      await bus.dispatch(
        'sequence:complete',
        buildPluginPayload({
          ctxData: undefined,
          store,
          provide,
          meta: { context: store },
        }),
      )
      return successResult
    }

    const failOutcome = outcome as Extract<typeof outcome, { kind: 'fail' }>
    const rolledBack = await rollbackCompletedSteps(
      completed,
      provide,
      failOutcome.inlineRollback,
    )

    return {
      status: 'failed',
      context: store as TContext,
      error: toActexError(new Error(failOutcome.message)),
      rolledBack,
    }
  }

  const successResult: Result<TContext> = {
    status: 'success',
    context: store as TContext,
    last: lastOutput,
  }

  await bus.dispatch(
    'sequence:complete',
    buildPluginPayload({
      ctxData: undefined,
      store,
      provide,
      meta: { context: store },
    }),
  )

  return successResult
}
