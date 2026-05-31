import type { SequenceBuilderState } from '../interfaces/sequence-builder-state'
import type { Result } from '../types/result'
import {
  createSequenceBuilder,
  type SequenceBuilder,
} from '../services/sequence/builder'
import { runSequence } from '../services/sequence/run-sequence'

export class Sequence {
  private constructor() {
    Object.freeze(this)
  }

  public static create(): Sequence {
    return new Sequence()
  }

  public createBuilder<
    TInput = unknown,
    TContext = unknown,
    TProvide extends Record<string, unknown> = Record<string, unknown>,
  >(): SequenceBuilder<TInput, TContext, TProvide> {
    return createSequenceBuilder<TInput, TContext, TProvide>({
      steps: [],
      plugins: [],
      listeners: [],
      provide: {} as TProvide,
    })
  }

  public runFromState<TContext>(
    state: SequenceBuilderState,
    input: unknown,
  ): Promise<Result<TContext>> {
    return runSequence(state, input)
  }
}
