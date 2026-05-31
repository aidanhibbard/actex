import type { ActexError } from './actex-error'

export type PluginStepRef = {
  readonly name: string
}

export type PluginEventMeta =
  | {
      readonly input: unknown
    }
  | {
      readonly step: PluginStepRef
    }
  | {
      readonly step: PluginStepRef
      readonly error: ActexError
    }
  | {
      readonly step: PluginStepRef
      readonly reason?: string
    }
  | {
      readonly context: unknown
    }
  | {
      readonly error: ActexError
      readonly step?: PluginStepRef
    }
