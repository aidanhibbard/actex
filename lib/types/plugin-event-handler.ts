import type { PluginPayload } from './plugin-payload'

export type PluginEventHandler = (
  payload: PluginPayload,
) => void | Promise<void>
