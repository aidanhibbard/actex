import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { definePlugin } from '../../lib/define-plugin'
import { defineSequence } from '../../lib/define-sequence'
import { step } from '../../lib/step'
import type { PluginEventHandler } from '../../lib/types/plugin-event-handler'

describe('definePlugin', () => {
  it('returns the plugin definition with name', () => {
    const plugin = definePlugin({
      name: 'test',
      'step:before': () => undefined,
    })

    expect(plugin.name).toBe('test')
    expect(plugin['step:before']).toBeTypeOf('function')
  })

  it('registers flat event handlers on the run bus', async () => {
    const before = vi.fn<PluginEventHandler>()
    const plugin = definePlugin({
      name: 'observer',
      'step:before': before,
    })

    const s = step({
      name: 'one',
      input: z.object({ value: z.number() }),
      output: z.object({ value: z.number() }),
      process: ({ ctx }) => ({ value: ctx.data.value }),
    })

    await defineSequence().use(plugin).step(s).run({ value: 1 })

    expect(before).toHaveBeenCalledOnce()
    const payload = before.mock.calls[0]?.[0]
    expect(payload?.meta).toMatchObject({
      step: { name: 'one' },
    })
  })
})
