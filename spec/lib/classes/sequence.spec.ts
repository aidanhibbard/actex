import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { Sequence } from '../../../lib/classes/sequence'
import { definePlugin } from '../../../lib/define-plugin'
import { createSequenceBuilder } from '../../../lib/services/sequence/builder'
import { step } from '../../../lib/step'

describe('Sequence', () => {
  it('createBuilder runs through runSequence', async () => {
    const s = step({
      name: 'add',
      input: z.object({ n: z.number() }),
      output: z.object({ n: z.number() }),
      process: ({ ctx }) => ({ n: ctx.data.n + 1 }),
    })

    const result = await Sequence.create().createBuilder().step(s).run({ n: 1 })

    expect(result.status === 'success' && result.context).toEqual({ n: 2 })
  })

  it('runFromState executes builder state directly', async () => {
    const s = step({
      name: 'id',
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string() }),
      process: ({ ctx }) => ({ id: ctx.data.id }),
    })

    const state = {
      steps: [s],
      plugins: [],
      listeners: [],
      provide: {},
    }

    const result = await Sequence.create().runFromState(state, { id: 'x' })
    expect(result.status === 'success' && result.context).toEqual({ id: 'x' })
  })

  it('exposes createSequenceBuilder provide, use, on, and steps', async () => {
    const handler = vi.fn()
    const s = step({
      name: 'only',
      input: z.object({ v: z.number() }),
      output: z.object({ v: z.number() }),
      process: ({ ctx }) => ({ v: ctx.data.v }),
    })

    const result = await createSequenceBuilder()
      .provide({})
      .use(definePlugin({ name: 'p', 'sequence:complete': handler }))
      .on('sequence:start', vi.fn())
      .steps(s)
      .run({ v: 2 })

    expect(result.status === 'success' && result.context).toEqual({ v: 2 })
    expect(handler).toHaveBeenCalled()
  })

  it('falls back to handle name when wrapStep clears the step name', async () => {
    const named = step({
      name: 'named',
      input: z.object({}),
      output: z.object({ ok: z.boolean() }),
      process: () => ({ ok: true }),
    })

    const plugin = definePlugin({
      name: 'rename',
      wrapStep: (stepDef) => ({
        ...stepDef,
        name: undefined,
      }),
    })

    const result = await createSequenceBuilder().use(plugin).step(named).run({})

    expect(result.status).toBe('success')
  })

  it('preserves rollback when wrapStep omits it', async () => {
    const rolledBack = vi.fn()
    const withRollback = step({
      name: 'withRollback',
      input: z.object({}),
      output: z.object({ tag: z.string() }),
      rollback: () => {
        rolledBack()
      },
      process: () => ({ tag: 'ok' }),
    })

    const plugin = definePlugin({
      name: 'stripProcessOnly',
      wrapStep: (stepDef) => {
        const { rollback, ...rest } = stepDef
        void rollback
        return {
          ...rest,
          process: () => {
            throw new Error('wrapped')
          },
        }
      },
    })

    await createSequenceBuilder().use(plugin).step(withRollback).run({})
    expect(rolledBack).toHaveBeenCalled()
  })

  it('wraps steps without rollback through plugins', async () => {
    const bare = step({
      name: 'bare',
      input: z.object({}),
      output: z.object({ ok: z.boolean() }),
      process: () => ({ ok: true }),
    })

    const result = await createSequenceBuilder()
      .use(definePlugin({ name: 'noop' }))
      .step(bare)
      .run({})

    expect(result.status).toBe('success')
  })
})
