import type { PluginEventHandler } from '../../types/plugin-event-handler'
import type { PluginPayload } from '../../types/plugin-payload'

import { appendPendingPromise } from './pending-promises'

const isPromiseLike = (value: unknown): value is Promise<void> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof (value as Promise<void>).then === 'function'
  )
}

export const wrapPluginEventListener = (
  handler: PluginEventHandler,
): EventListener => {
  return (event: Event): void => {
    if (!(event instanceof CustomEvent)) {
      return
    }

    const result = handler(event.detail as PluginPayload)

    if (isPromiseLike(result)) {
      appendPendingPromise(event, result)
    }
  }
}
