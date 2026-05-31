import { describe, expect, it, vi } from 'vitest'

import { EventBus } from '../../../../lib/classes/event-bus'
import type { PluginPayload } from '../../../../lib/types/plugin-payload'

const createPayload = (): PluginPayload => ({
  ctx: undefined,
  env: {
    store: { count: 1 },
    provide: { logger: { debug: vi.fn() } },
  },
  meta: { step: { name: 'charge' } },
})

describe('listenService', () => {
  it('registers a listener and unlisten removes it', async () => {
    const bus = EventBus.create()
    const payload = createPayload()
    const handler = vi.fn()

    const { unlisten } = bus.listen('step:before', handler)
    await bus.dispatch('step:before', payload)
    expect(handler).toHaveBeenCalledTimes(1)

    unlisten()
    await bus.dispatch('step:before', payload)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('passes listener options through to EventTarget', async () => {
    const bus = EventBus.create()
    const payload = createPayload()
    const handler = vi.fn()

    bus.listen('step:after', handler, { once: true })
    await bus.dispatch('step:after', payload)
    await bus.dispatch('step:after', payload)

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('supports multiple listeners for the same event', async () => {
    const bus = EventBus.create()
    const payload = createPayload()
    const first = vi.fn()
    const second = vi.fn()

    bus.listen('step:fail', first)
    bus.listen('step:fail', second)
    await bus.dispatch('step:fail', payload)

    expect(first).toHaveBeenCalledWith(payload)
    expect(second).toHaveBeenCalledWith(payload)
  })
})
