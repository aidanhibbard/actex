import type { FailOptions } from '../types/fail-options'

export class StepFailSignal extends Error {
  public readonly options: FailOptions | undefined

  public constructor(message: string, options?: FailOptions) {
    super(message)
    this.name = 'StepFailSignal'
    this.options = options
  }
}

export class StepSkipSignal extends Error {
  public constructor(message?: string) {
    super(message ?? 'skipped')
    this.name = 'StepSkipSignal'
  }
}

export class StepSkipAllSignal extends Error {
  public constructor(message?: string) {
    super(message ?? 'skipped all')
    this.name = 'StepSkipAllSignal'
  }
}

export class StepAbortSignal extends Error {
  public constructor(message: string) {
    super(message)
    this.name = 'StepAbortSignal'
  }
}
