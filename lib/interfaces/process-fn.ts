import type { ProcessContext } from './process-context'

export type ProcessFn<
  TInput,
  TOutput,
  TProvide extends Record<string, unknown>,
> = (context: ProcessContext<TInput, TProvide>) => TOutput | Promise<TOutput>

export type RollbackFn<
  TInput,
  TOutput,
  TProvide extends Record<string, unknown>,
> = (args: {
  readonly ctx: { readonly data: TInput }
  readonly output: TOutput | undefined
  readonly provide: TProvide
}) => void | Promise<void>
