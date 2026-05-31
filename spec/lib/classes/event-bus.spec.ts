import { describe, expect, it, vi } from 'vitest'

import { EventBus } from '../../../lib/classes/event-bus'
import type { PluginPayload } from '../../../lib/types/plugin-payload'

const createPayload = (): PluginPayload => ({
  ctx: { data: { orderId: 'ord_1' } },
  env: {
    store: {},
    provide: {},
  },
  meta: { input: 'input-value' },
})

describe('EventBus', () => {
  it('creates an isolated bus per call', () => {
    const first = EventBus.create()
    const second = EventBus.create()

    expect(first).not.toBe(second)
  })

  it('dispatches payloads to listeners registered on the same bus', async () => {
    const bus = EventBus.create()
    const payload = createPayload()
    const handler = vi.fn()

    bus.listen('sequence:start', handler)
    await bus.dispatch('sequence:start', payload)

    expect(handler).toHaveBeenCalledWith(payload)
  })
})
