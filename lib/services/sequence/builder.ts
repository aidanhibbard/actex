import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { Plugin } from '../../interfaces/plugin'
import type { SequenceBuilderState } from '../../interfaces/sequence-builder-state'
import type { StepHandle } from '../../interfaces/step-handle'

type AnyStep = StepHandle
import type { Result } from '../../types/result'
import type { PluginEventName } from '../../types/plugin-event-name'
import type { ListenerOptions } from '../../types/listener-options'
import type { PluginEventHandler } from '../../types/plugin-event-handler'
import { runSequence } from './run-sequence'

export interface SequenceBuilder<
  TInput = unknown,
  TContext = unknown,
  TProvide extends Record<string, unknown> = Record<string, unknown>,
> {
  provide(deps: TProvide): SequenceBuilder<TInput, TContext, TProvide>
  use(...plugins: Plugin[]): SequenceBuilder<TInput, TContext, TProvide>
  on(
    event: PluginEventName,
    handler: PluginEventHandler,
    options?: ListenerOptions,
  ): SequenceBuilder<TInput, TContext, TProvide>
  step<S extends AnyStep>(
    stepHandle: S,
  ): SequenceBuilder<
    [TInput] extends [unknown]
      ? StandardSchemaV1.InferOutput<S['input']>
      : TInput,
    MergeStore<TContext, StandardSchemaV1.InferOutput<S['output']>>,
    TProvide
  >
  steps<S extends readonly AnyStep[]>(
    ...stepHandles: S
  ): SequenceBuilder<TInput, FoldStepsOutput<TContext, S>, TProvide>
  run(runInput: TInput): Promise<Result<TContext>>
}

type MergeStore<TStore, TOutput> = TStore extends unknown
  ? TOutput extends Record<string, unknown>
    ? TStore extends Record<string, unknown>
      ? TStore & TOutput
      : TOutput
    : TOutput
  : never

type FoldStepsOutput<
  TStore,
  TSteps extends readonly AnyStep[],
> = TSteps extends readonly [
  infer Head extends AnyStep,
  ...infer Tail extends readonly AnyStep[],
]
  ? Tail extends readonly []
    ? MergeStore<TStore, StandardSchemaV1.InferOutput<Head['output']>>
    : FoldStepsOutput<
        MergeStore<TStore, StandardSchemaV1.InferOutput<Head['output']>>,
        Tail
      >
  : TStore

const emptyBuilderState = <
  TProvide extends Record<string, unknown> = Record<string, unknown>,
>(): SequenceBuilderState<TProvide> => ({
  steps: [],
  plugins: [],
  listeners: [],
  provide: {} as TProvide,
})

export const createSequenceBuilder = <
  TInput = unknown,
  TContext = unknown,
  TProvide extends Record<string, unknown> = Record<string, unknown>,
>(
  state: SequenceBuilderState<TProvide> = emptyBuilderState<TProvide>(),
): SequenceBuilder<TInput, TContext, TProvide> => ({
  provide: (deps) =>
    createSequenceBuilder<TInput, TContext, TProvide>({
      ...state,
      provide: { ...state.provide, ...deps },
    }),
  use: (...plugins) =>
    createSequenceBuilder<TInput, TContext, TProvide>({
      ...state,
      plugins: [...state.plugins, ...plugins],
    }),
  on: (event, handler, options) =>
    createSequenceBuilder<TInput, TContext, TProvide>({
      ...state,
      listeners: [
        ...state.listeners,
        {
          event,
          handler,
          ...(options !== undefined ? { options } : {}),
        },
      ],
    }),
  step: (stepHandle) =>
    createSequenceBuilder<
      StandardSchemaV1.InferOutput<(typeof stepHandle)['input']>,
      MergeStore<
        TContext,
        StandardSchemaV1.InferOutput<(typeof stepHandle)['output']>
      >,
      TProvide
    >({
      ...state,
      steps: [...state.steps, stepHandle],
    }),
  steps: (...stepHandles) =>
    createSequenceBuilder<
      TInput,
      FoldStepsOutput<TContext, typeof stepHandles>,
      TProvide
    >({
      ...state,
      steps: [...state.steps, ...stepHandles],
    }),
  run: (runInput) => runSequence(state, runInput),
})
