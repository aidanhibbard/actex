import type { FailOptions } from '../interfaces/process-context'

export type { FailOptions } from '../interfaces/process-context'

export type FailFn = (message: string, options?: FailOptions) => never

export type SkipFn = (message?: string) => never

export type ProcessArgs<Ti, TProvide extends Record<string, unknown>> = {
  readonly ctx: { readonly data: Ti }
  readonly provide: TProvide
  readonly fail: FailFn
  readonly skip: SkipFn
  readonly skipAll: SkipFn
}

export type ProcessFn<
  Ti,
  To,
  TProvide extends Record<string, unknown> = Record<string, unknown>,
> = (args: ProcessArgs<Ti, TProvide>) => To | Promise<To>
