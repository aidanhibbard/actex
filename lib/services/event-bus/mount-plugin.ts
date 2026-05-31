import type { EventBus } from '../../classes/event-bus'
import type { PluginDef } from '../../interfaces/plugin-def'
import type { MountPluginResult } from '../../types/mount-plugin-result'
import type { PluginEventName } from '../../types/plugin-event-name'

const PLUGIN_RESERVED_KEYS = new Set(['name', 'wrapStep'])

const isPluginEventName = (key: string): key is PluginEventName => {
  return !PLUGIN_RESERVED_KEYS.has(key)
}

export const mountPluginService = function (
  this: EventBus,
  plugin: PluginDef,
): MountPluginResult {
  const unlisteners: (() => void)[] = []

  for (const key of Object.keys(plugin)) {
    if (!isPluginEventName(key)) {
      continue
    }

    const handler = plugin[key]

    if (handler === undefined) {
      continue
    }

    const { unlisten } = this.listen(key, handler)
    unlisteners.push(unlisten)
  }

  return {
    ...(plugin.wrapStep !== undefined ? { wrapStep: plugin.wrapStep } : {}),
    unmount: (): void => {
      for (const unlisten of unlisteners) {
        unlisten()
      }
    },
  }
}
