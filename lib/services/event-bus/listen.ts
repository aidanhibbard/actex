import type { EventBus } from '../../classes/event-bus'
import type { ListenerOptions } from '../../types/listener-options'
import type { PluginEventHandler } from '../../types/plugin-event-handler'
import type { PluginEventName } from '../../types/plugin-event-name'

import { getEventBusTarget } from './target-access'
import { wrapPluginEventListener } from './wrap-listener'

export const listenService = function (
  this: EventBus,
  type: PluginEventName,
  handler: PluginEventHandler,
  options?: ListenerOptions,
): { unlisten: () => void } {
  const target = getEventBusTarget(this)
  const listener = wrapPluginEventListener(handler)
  target.addEventListener(type, listener, options)

  return {
    unlisten: (): void => {
      target.removeEventListener(type, listener, options)
    },
  }
}
