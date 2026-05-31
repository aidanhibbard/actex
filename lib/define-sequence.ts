import { Sequence } from './classes/sequence'
import type { SequenceBuilder } from './services/sequence/builder'

export const defineSequence = <
  Ti = unknown,
  To = unknown,
  TProvide extends Record<string, unknown> = Record<string, unknown>,
>(): SequenceBuilder<Ti, To, TProvide> =>
  Sequence.create().createBuilder<Ti, To, TProvide>()
