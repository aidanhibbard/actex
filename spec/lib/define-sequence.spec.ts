import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { definePlugin } from '../../lib/define-plugin'
import { defineSequence } from '../../lib/define-sequence'
import { step } from '../../lib/step'
import type { RollbackArgs } from '../../lib/types/rollback-fn'

const increment = step({
  name: 'increment',
  input: z.object({ count: z.number() }),
  output: z.object({ count: z.number() }),
  process: ({ ctx }) => ({ count: ctx.data.count + 1 }),
})

const double = step({
  name: 'double',
  input: z.object({ count: z.number() }),
  output: z.object({ count: z.number() }),
  process: ({ ctx }) => ({ count: ctx.data.count * 2 }),
})

interface LoggerProvide {
  logger: { lines: string[] }
}
interface RolledBackProvide {
  rolledBack: string[]
}

describe('defineSequence', () => {
  it('runs a flat sequence and merges store', async () => {
    const result = await defineSequence()
      .step(increment)
      .step(double)
      .run({ count: 1 })

    expect(result).toEqual({
      status: 'success',
      context: { count: 4 },
      last: { count: 4 },
    })
  })

  it('splats steps via steps()', async () => {
    const result = await defineSequence()
      .steps(increment, double)
      .run({ count: 0 })

    expect(result.status).toBe('success')
    expect(result.status === 'success' && result.context).toEqual({ count: 2 })
  })

  it('injects provide into steps', async () => {
    const logger = { lines: [] as string[] }
    const logging = step<Record<string, never>, { ok: boolean }, LoggerProvide>(
      {
        name: 'logging',
        input: z.object({}),
        output: z.object({ ok: z.boolean() }),
        process: ({ provide }) => {
          provide.logger.lines.push('ran')
          return { ok: true }
        },
      },
    )

    const result = await defineSequence<{ ok: boolean }>()
      .provide({ logger })
      .step(logging)
      .run({})

    expect(result.status).toBe('success')
    expect(logger.lines).toEqual(['ran'])
  })

  it('fires sequence:start and sequence:complete on success', async () => {
    const start = vi.fn()
    const complete = vi.fn()

    await defineSequence()
      .on('sequence:start', start, { once: true })
      .on('sequence:complete', complete)
      .step(increment)
      .run({ count: 0 })

    expect(start).toHaveBeenCalledOnce()
    expect(complete).toHaveBeenCalledOnce()
  })

  it('strips undeclared keys from run input via first step input shape', async () => {
    const capture = step({
      name: 'capture',
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string() }),
      process: ({ ctx }) => ({ id: ctx.data.id }),
    })

    const result = await defineSequence().step(capture).run({
      id: 'a',
      extra: 'removed',
    })

    expect(result.status === 'success' && result.context).toEqual({ id: 'a' })
  })

  it('rejects invalid run input', async () => {
    await expect(
      defineSequence().step(increment).run({ count: 'nope' }),
    ).rejects.toThrow(/Invalid input|Validation failed/)
  })

  it('handles skip() without a custom message', async () => {
    const defaultSkip = step({
      name: 'defaultSkip',
      input: z.object({}),
      output: z.object({}),
      process: ({ skip }) => {
        skip()
      },
    })

    const result = await defineSequence().step(defaultSkip).run({})
    expect(result.status).toBe('success')
    expect(result.status === 'success' && result.reason).toBe('skipped')
  })

  it('handles skip control flow as success', async () => {
    const skipper = step({
      name: 'skipper',
      input: z.object({}),
      output: z.object({}),
      process: ({ skip }) => {
        skip('not needed')
      },
    })

    const result = await defineSequence().step(skipper).step(increment).run({})

    expect(result).toMatchObject({
      status: 'success',
      reason: 'not needed',
      step: 'skipper',
    })
    expect(result.status === 'success' && result.context).toEqual({})
  })

  it('handles skipAll control flow as success', async () => {
    const skipAllStep = step({
      name: 'skipAllStep',
      input: z.object({ count: z.number() }),
      output: z.object({ count: z.number() }),
      process: ({ skipAll }) => {
        skipAll('halt pipeline')
      },
    })

    const result = await defineSequence()
      .step(skipAllStep)
      .step(double)
      .run({ count: 1 })

    expect(result).toMatchObject({
      status: 'success',
      reason: 'halt pipeline',
    })
    expect(result.status === 'success' && result.context).toEqual({ count: 1 })
  })

  it('handles fail with rollback of completed steps', async () => {
    const rolledBack: string[] = []

    const reserve = step<
      Record<string, never>,
      { reservation: string },
      RolledBackProvide
    >({
      name: 'reserve',
      input: z.object({}),
      output: z.object({ reservation: z.string() }),
      rollback: ({
        output,
        provide,
      }: RollbackArgs<
        Record<string, never>,
        { reservation: string },
        RolledBackProvide
      >) => {
        const reservation = output?.reservation ?? ''
        provide.rolledBack.push(reservation)
      },
      process: () => ({ reservation: 'r1' }),
    })

    const failStep = step({
      name: 'failStep',
      input: z.object({ reservation: z.string() }),
      output: z.object({}),
      process: ({ fail }) => {
        fail('boom')
      },
    })

    const result = await defineSequence()
      .provide({ rolledBack })
      .step(reserve)
      .step(failStep)
      .run({})

    expect(result.status).toBe('failed')
    expect(result.status === 'failed' && result.rolledBack).toBe(true)
    expect(rolledBack).toEqual(['r1'])
  })

  it('supports inline rollback on fail()', async () => {
    const rolledBack: string[] = []

    const failWithInline = step<
      Record<string, never>,
      Record<string, never>,
      RolledBackProvide
    >({
      name: 'failWithInline',
      input: z.object({}),
      output: z.object({}),
      process: ({ fail, provide }) => {
        fail('inline', {
          rollback: () => {
            provide.rolledBack.push('inline')
          },
        })
      },
    })

    const result = await defineSequence()
      .provide({ rolledBack })
      .step(failWithInline)
      .run({})

    expect(result.status === 'failed' && result.rolledBack).toBe(true)
    expect(rolledBack).toEqual(['inline'])
  })

  it('dispatches step:fail without sequence:error on fail()', async () => {
    const stepFail = vi.fn()
    const sequenceError = vi.fn()

    const failing = step({
      name: 'failing',
      input: z.object({}),
      output: z.object({}),
      process: ({ fail }) => {
        fail('nope')
      },
    })

    await defineSequence()
      .on('step:fail', stepFail)
      .on('sequence:error', sequenceError)
      .step(failing)
      .run({})

    expect(stepFail).toHaveBeenCalledOnce()
    expect(sequenceError).not.toHaveBeenCalled()
  })

  it('marks rolledBack when executeStep rolled back an in-flight step', async () => {
    const rolledBack: string[] = []
    const throws = step<
      Record<string, never>,
      Record<string, never>,
      RolledBackProvide
    >({
      name: 'throws',
      input: z.object({}),
      output: z.object({}),
      rollback: ({ provide }) => {
        provide.rolledBack.push('throws')
      },
      process: () => {
        throw new Error('kaboom')
      },
    })

    const result = await defineSequence()
      .provide({ rolledBack })
      .step(throws)
      .run({})

    expect(result.status === 'failed' && result.rolledBack).toBe(true)
    expect(rolledBack).toEqual(['throws'])
  })

  it('rolls back the in-flight step from the run catch path', async () => {
    const rolledBack: string[] = []
    const throws = step<
      { token: string },
      { token: string },
      RolledBackProvide
    >({
      name: 'inFlight',
      input: z.object({ token: z.string() }),
      output: z.object({ token: z.string() }),
      rollback: ({
        ctx,
        provide,
      }: RollbackArgs<
        { token: string },
        { token: string },
        RolledBackProvide
      >) => {
        provide.rolledBack.push(ctx.data.token)
      },
      process: () => {
        throw new Error('kaboom')
      },
    })

    const result = await defineSequence()
      .provide({ rolledBack })
      .step(throws)
      .run({ token: 't1' })

    expect(result.status === 'failed' && result.rolledBack).toBe(true)
    expect(rolledBack).toEqual(['t1'])
  })

  it('does not rollback when the throwing step has no rollback hook', async () => {
    const noRollback = step({
      name: 'noRollback',
      input: z.object({}),
      output: z.object({}),
      process: () => {
        throw new Error('no hook')
      },
    })

    const result = await defineSequence().step(noRollback).run({})
    expect(result.status === 'failed' && result.rolledBack).toBe(false)
  })

  it('dispatches sequence:error and rolls back on uncaught throw', async () => {
    const sequenceError = vi.fn()
    const rolledBack: string[] = []

    const throws = step<
      Record<string, never>,
      { tag: string },
      RolledBackProvide
    >({
      name: 'throws',
      input: z.object({}),
      output: z.object({ tag: z.string() }),
      rollback: ({ provide }) => {
        provide.rolledBack.push('throws')
      },
      process: () => {
        throw new Error('kaboom')
      },
    })

    const result = await defineSequence()
      .provide({ rolledBack })
      .on('sequence:error', sequenceError)
      .step(throws)
      .run({})

    expect(sequenceError).toHaveBeenCalledOnce()
    expect(result.status).toBe('failed')
    expect(rolledBack).toEqual(['throws'])
  })

  it('wraps steps with plugin wrapStep including abort', async () => {
    const plugin = definePlugin({
      name: 'timeout',
      wrapStep: (stepDef, { abort }) => ({
        ...stepDef,
        process: (args) => {
          abort('timed out')
          return stepDef.process(args)
        },
      }),
    })

    const s = step({
      name: 'never',
      input: z.object({}),
      output: z.object({}),
      process: () => ({}),
    })

    const result = await defineSequence().use(plugin).step(s).run({})

    expect(result.status).toBe('failed')
    expect(result.status === 'failed' && result.error.message).toBe('timed out')
  })

  it('awaits async plugin handlers before continuing', async () => {
    const order: string[] = []
    const plugin = definePlugin({
      name: 'async',
      'step:after': async () => {
        await Promise.resolve()
        order.push('after')
      },
    })

    const s = step({
      name: 's',
      input: z.object({}),
      output: z.object({ done: z.boolean() }),
      process: () => {
        order.push('process')
        return { done: true }
      },
    })

    await defineSequence().use(plugin).step(s).run({})
    expect(order).toEqual(['process', 'after'])
  })

  it('rejects invalid step output at runtime', async () => {
    const badOutput = step({
      name: 'badOutput',
      input: z.object({}),
      output: z.object({ n: z.number() }),
      process: () => ({ n: 'not-a-number' }),
    })

    await expect(defineSequence().step(badOutput).run({})).rejects.toThrow()
  })

  it('rejects store that does not satisfy a later step input', async () => {
    const first = step({
      name: 'first',
      input: z.object({}),
      output: z.object({ a: z.string() }),
      process: () => ({ a: 'ok' }),
    })
    const second = step({
      name: 'second',
      input: z.object({ b: z.number() }),
      output: z.object({}),
      process: () => ({}),
    })

    await expect(
      defineSequence().step(first).step(second).run({}),
    ).rejects.toThrow()
  })

  it('keeps manual Ti when defineSequence is explicitly bounded', async () => {
    const result = await defineSequence<{ count: number }, { count: number }>()
      .step(increment)
      .step(double)
      .run({ count: 1 })

    expect(result.status === 'success' && result.context).toEqual({ count: 4 })
  })

  it('skips rollback for completed steps without a rollback hook', async () => {
    const noHook = step({
      name: 'noHook',
      input: z.object({}),
      output: z.object({ seed: z.string() }),
      process: () => ({ seed: 'done' }),
    })
    const failing = step({
      name: 'failing',
      input: z.object({ seed: z.string() }),
      output: z.object({}),
      process: ({ fail }) => {
        fail('stop')
      },
    })

    const result = await defineSequence().step(noHook).step(failing).run({})

    expect(result.status === 'failed' && result.rolledBack).toBe(false)
  })

  it('chains builder provide, use, and on before steps', async () => {
    const handler = vi.fn()
    const plugin = definePlugin({
      name: 'chain',
      'sequence:complete': handler,
    })

    await defineSequence()
      .provide({ tag: 'run' })
      .use(plugin)
      .on('sequence:start', vi.fn())
      .step(increment)
      .run({ count: 0 })

    expect(handler).toHaveBeenCalled()
  })

  it('returns success for an empty sequence', async () => {
    const result = await defineSequence().run({ kept: true })
    expect(result).toEqual({
      status: 'success',
      context: { kept: true },
      last: { kept: true },
    })
  })
})
