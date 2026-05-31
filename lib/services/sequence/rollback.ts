import type { StepHandle } from '../../interfaces/step-handle'

export interface CompletedStepRecord {
  readonly handle: StepHandle
  readonly input: unknown
  readonly output: unknown
}

export const rollbackCompletedSteps = async (
  completed: readonly CompletedStepRecord[],
  provide: Record<string, unknown>,
  inlineRollback?: () => Promise<void>,
): Promise<boolean> => {
  let rolledBack = false

  if (inlineRollback !== undefined) {
    await inlineRollback()
    rolledBack = true
  }

  for (const record of [...completed].reverse()) {
    if (record.handle.rollback === undefined) {
      continue
    }
    await record.handle.rollback({
      ctx: { data: record.input },
      output: record.output,
      provide,
    })
    rolledBack = true
  }

  return rolledBack
}
