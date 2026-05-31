import type { ListenerOptions } from '../types/listener-options'
import type { PluginEventHandler } from '../types/plugin-event-handler'
import type { PluginEventName } from '../types/plugin-event-name'
import type { Plugin } from './plugin'
import type { StepHandle } from './step-handle'

export interface SequenceListenerRegistration {
  readonly event: PluginEventName
  readonly handler: PluginEventHandler
  readonly options?: ListenerOptions
}

export interface SequenceBuilderState<
  TProvide extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly steps: readonly StepHandle[]
  readonly plugins: readonly Plugin[]
  readonly listeners: readonly SequenceListenerRegistration[]
  readonly provide: TProvide
}
