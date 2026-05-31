import type { PluginEventName } from '../types/plugin-event-name'
import type { PluginEventHandler } from '../types/plugin-event-handler'
import type { WrapStepFn } from '../types/wrap-step-fn'

export interface PluginDef extends Partial<
  Record<PluginEventName, PluginEventHandler>
> {
  readonly name: string
  readonly wrapStep?: WrapStepFn
}
