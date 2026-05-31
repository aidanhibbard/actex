import { describe, expect, it, vi } from 'vitest'

import { EventBus } from '../../../../lib/classes/event-bus'
import type { PluginPayload } from '../../../../lib/types/plugin-payload'

const createPayload = (): PluginPayload => ({
  ctx: { data: null },
  env: {
    store: {},
    provide: {},
  },
  meta: { context: { done: true } },
})

describe('dispatchService', () => {
  it('dispatches a CustomEvent with the plugin payload as detail', async () => {
    const bus = EventBus.create()
    const payload = createPayload()
    const target = vi.fn()

    bus.listen('sequence:complete', target)
    await bus.dispatch('sequence:complete', payload)

    expect(target).toHaveBeenCalledWith(payload)
  })

  it('awaits async listeners before resolving dispatch', async () => {
    const bus = EventBus.create()
    const payload = createPayload()
    const order: string[] = []

    bus.listen('sequence:error', async () => {
      order.push('listener-start')
      await Promise.resolve()
      order.push('listener-end')
    })

    const dispatchPromise = bus.dispatch('sequence:error', payload)
    order.push('after-dispatch-called')
    await dispatchPromise
    order.push('dispatch-settled')

    expect(order).toEqual([
      'listener-start',
      'after-dispatch-called',
      'listener-end',
      'dispatch-settled',
    ])
  })

  it('awaits multiple async listeners in parallel', async () => {
    const bus = EventBus.create()
    const payload = createPayload()
    let firstDone = false
    let secondDone = false

    bus.listen('step:skip', async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 10)
      })
      firstDone = true
    })
    bus.listen('step:skip', async () => {
      await Promise.resolve()
      secondDone = true
    })

    await bus.dispatch('step:skip', payload)

    expect(firstDone).toBe(true)
    expect(secondDone).toBe(true)
  })

  it('resolves when no listeners are registered', async () => {
    const bus = EventBus.create()
    const payload = createPayload()

    await expect(
      bus.dispatch('sequence:start', payload),
    ).resolves.toBeUndefined()
  })
})
