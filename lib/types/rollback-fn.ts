export type RollbackArgs<Ti, To, TProvide extends Record<string, unknown>> = {
  readonly ctx: { readonly data: Ti }
  readonly output: To | undefined
  readonly provide: TProvide
}

export type RollbackFn<
  Ti,
  To,
  TProvide extends Record<string, unknown> = Record<string, unknown>,
> = (args: RollbackArgs<Ti, To, TProvide>) => void | Promise<void>
