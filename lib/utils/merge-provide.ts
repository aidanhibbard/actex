export const mergeProvide = <TProvide extends Record<string, unknown>>(
  defaultProvide: Partial<TProvide> | undefined,
  runtimeProvide: Partial<TProvide> | undefined,
): TProvide => {
  return {
    ...(defaultProvide ?? {}),
    ...(runtimeProvide ?? {}),
  } as TProvide
}
