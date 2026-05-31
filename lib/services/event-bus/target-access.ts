import type { EventBus } from '../../classes/event-bus'

const targets = new WeakMap<EventBus, EventTarget>()

export const registerEventBusTarget = (
  bus: EventBus,
  target: EventTarget,
): void => {
  targets.set(bus, target)
}

export const getEventBusTarget = (bus: EventBus): EventTarget => {
  const target = targets.get(bus)

  if (target === undefined) {
    throw new Error('EventBus target is not registered')
  }

  return target
}
