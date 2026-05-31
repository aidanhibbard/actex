const pendingPromises = new WeakMap<Event, Promise<void>[]>()

export const initPendingPromises = (event: Event): void => {
  pendingPromises.set(event, [])
}

export const appendPendingPromise = (
  event: Event,
  promise: Promise<void>,
): void => {
  const promises = pendingPromises.get(event) ?? []
  promises.push(promise)
  pendingPromises.set(event, promises)
}

export const getPendingPromises = (event: Event): Promise<void>[] => {
  return pendingPromises.get(event) ?? []
}
