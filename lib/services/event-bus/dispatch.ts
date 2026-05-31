import type { EventBus } from '../../classes/event-bus'
import type { PluginEventName } from '../../types/plugin-event-name'
import type { PluginPayload } from '../../types/plugin-payload'

import { getPendingPromises, initPendingPromises } from './pending-promises'
import { getEventBusTarget } from './target-access'

export const dispatchService = async function (
  this: EventBus,
  type: PluginEventName,
  payload: PluginPayload,
): Promise<void> {
  const target = getEventBusTarget(this)
  const event = new CustomEvent(type, { detail: payload })
  initPendingPromises(event)
  target.dispatchEvent(event)
  await Promise.all(getPendingPromises(event))
}
