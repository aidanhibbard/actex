export interface FailOptions {
  readonly rollback?: () => Promise<void>
}

export interface ProcessContext<
  TInput,
  TProvide extends Record<string, unknown>,
> {
  readonly ctx: { readonly data: TInput }
  readonly provide: TProvide
  readonly fail: (message: string, options?: FailOptions) => never
  readonly skip: (message?: string) => never
  readonly skipAll: (message?: string) => never
}
