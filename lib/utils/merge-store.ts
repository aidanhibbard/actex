export const mergeStore = <TInput extends Record<string, unknown>, TOutput>(
  input: TInput,
  output: TOutput,
): TInput & TOutput => {
  if (typeof output === 'object' && output !== null && !Array.isArray(output)) {
    return { ...input, ...output }
  }

  return { ...input, ...(output as Record<string, unknown>) } as TInput &
    TOutput
}
