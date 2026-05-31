import { describe, expect, it, vi } from 'vitest'

import { EventBus } from '../../../../lib/classes/event-bus'
import type { PluginDef } from '../../../../lib/interfaces/plugin-def'
import type { PluginPayload } from '../../../../lib/types/plugin-payload'
import type { WrapStepFn } from '../../../../lib/types/wrap-step-fn'
import { getEventBusTarget } from '../../../../lib/services/event-bus/target-access'
import { wrapPluginEventListener } from '../../../../lib/services/event-bus/wrap-listener'
import {
  appendPendingPromise,
  getPendingPromises,
  initPendingPromises,
} from '../../../../lib/services/event-bus/pending-promises'

const createPayload = (): PluginPayload => ({
  ctx: { data: { id: 1 } },
  env: {
    store: {},
    provide: {},
  },
  meta: { input: 'start' },
})

describe('mountPluginService', () => {
  it('mounts flat event handlers from plugin definitions', async () => {
    const bus = EventBus.create()
    const payload = createPayload()
    const before = vi.fn()
    const fail = vi.fn()

    const plugin: PluginDef = {
      name: 'audit',
      'step:before': before,
      'step:fail': fail,
    }

    bus.mount(plugin)
    await bus.dispatch('step:before', payload)
    await bus.dispatch('step:fail', payload)

    expect(before).toHaveBeenCalledWith(payload)
    expect(fail).toHaveBeenCalledWith(payload)
  })

  it('returns wrapStep without registering it on the bus', async () => {
    const bus = EventBus.create()
    const wrapStep = vi.fn<WrapStepFn>((stepDef) => stepDef)

    const plugin: PluginDef = {
      name: 'timeout',
      wrapStep,
    }

    const mounted = bus.mount(plugin)

    expect(mounted.wrapStep).toBe(wrapStep)
    await expect(
      bus.dispatch('step:before', createPayload()),
    ).resolves.toBeUndefined()
  })

  it('unmount removes mounted plugin listeners', async () => {
    const bus = EventBus.create()
    const payload = createPayload()
    const handler = vi.fn()

    const mounted = bus.mount({
      name: 'metrics',
      'sequence:start': handler,
    })

    await bus.dispatch('sequence:start', payload)
    mounted.unmount()
    await bus.dispatch('sequence:start', payload)

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('skips reserved keys and undefined handlers on plugin definitions', async () => {
    const bus = EventBus.create()
    const handler = vi.fn()

    const mounted = bus.mount({
      name: 'sparse',
      wrapStep: vi.fn<WrapStepFn>((stepDef) => stepDef),
      'step:after': handler,
      'step:before': undefined,
    })

    await bus.dispatch('step:after', createPayload())
    await bus.dispatch('step:before', createPayload())

    expect(handler).toHaveBeenCalledTimes(1)
    expect(mounted.wrapStep).toBeTypeOf('function')
  })
})

describe('event-bus internals', () => {
  it('throws when resolving a target for an unregistered bus', () => {
    expect(() => getEventBusTarget({} as never)).toThrow(
      'EventBus target is not registered',
    )
  })

  it('ignores non-CustomEvent objects in wrapped listeners', () => {
    const handler = vi.fn()
    const listener = wrapPluginEventListener(handler)
    const event = new Event('step:before')

    listener(event)

    expect(handler).not.toHaveBeenCalled()
  })

  it('tracks pending promises on dispatched events', async () => {
    const event = new CustomEvent('step:after', { detail: createPayload() })
    initPendingPromises(event)

    const promise = Promise.resolve()
    appendPendingPromise(event, promise)

    expect(getPendingPromises(event)).toContain(promise)
    await promise
    expect(getPendingPromises(new Event('step:after'))).toEqual([])
  })

  it('creates pending promise storage when appending without initialization', async () => {
    const event = new Event('sequence:complete')
    const promise = Promise.resolve()

    appendPendingPromise(event, promise)

    expect(getPendingPromises(event)).toContain(promise)
    await promise
  })
})
