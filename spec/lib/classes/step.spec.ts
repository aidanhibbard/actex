import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { Step } from '../../../lib/classes/step'
import {
  StepAbortSignal,
  StepFailSignal,
  StepSkipAllSignal,
  StepSkipSignal,
} from '../../../lib/classes/step-signals'
import { ValidationError } from '../../../lib/classes/validation-error'
import { createStepService } from '../../../lib/services/step'
import {
  createStepSurface,
  runStepService,
} from '../../../lib/services/step/run-step'

describe('Step', () => {
  it('creates a step with defaults and exposes schemas', () => {
    const input = z.object({ id: z.string() })
    const output = z.object({ value: z.number() })
    const process = vi.fn(() => ({ value: 1 }))

    const instance = Step.create({
      input,
      output,
      process,
    })

    expect(instance.name).toBe('step')
    expect(instance.input).toBe(input)
    expect(instance.output).toBe(output)
    expect(instance.defaultProvide).toBeUndefined()
    expect(instance.rollback).toBeUndefined()
  })

  it('preserves custom name, provide defaults, and rollback', () => {
    const rollback = vi.fn()
    const instance = Step.create({
      name: 'named',
      input: z.object({}),
      output: z.object({}),
      defaultProvide: { logger: 'default' },
      rollback,
      process: () => ({}),
    })

    expect(instance.name).toBe('named')
    expect(instance.defaultProvide).toEqual({ logger: 'default' })
    expect(instance.rollback).toBe(rollback)
  })

  it('runs through the bound run service', async () => {
    const instance = Step.create({
      name: 'bound',
      input: z.object({ count: z.number() }),
      output: z.object({ total: z.number() }),
      process: ({ ctx }) => ({ total: ctx.data.count + 1 }),
    })

    const result = await instance.run({ count: 1 })

    expect(result).toEqual({
      status: 'success',
      context: { count: 1, total: 2 },
      last: { total: 2 },
    })
  })

  it('creates a public surface from toSurface', async () => {
    const instance = Step.create({
      input: z.object({ ok: z.boolean() }),
      output: z.object({ ok: z.boolean() }),
      process: ({ ctx }) => ({ ok: ctx.data.ok }),
    })

    const surface = instance.toSurface()
    const result = await surface.run({ ok: true })

    expect(result.status).toBe('success')
  })
})

describe('runStepService', () => {
  const buildStep = () =>
    Step.create({
      name: 'fetch',
      input: z.object({ orderId: z.string() }),
      output: z.object({
        order: z.object({ id: z.string(), subtotal: z.number() }),
      }),
      defaultProvide: { prisma: { label: 'default' } },
      process: ({ ctx, provide }) => ({
        order: {
          id: ctx.data.orderId,
          subtotal: provide.prisma.label === 'runtime' ? 20 : 10,
        },
      }),
    })

  it('validates input, merges provide, and returns success', async () => {
    const step = buildStep()
    const result = await runStepService(
      step,
      { orderId: 'ord_1' },
      {
        provide: { prisma: { label: 'runtime' } },
      },
    )

    expect(result).toEqual({
      status: 'success',
      context: {
        orderId: 'ord_1',
        order: { id: 'ord_1', subtotal: 20 },
      },
      last: { order: { id: 'ord_1', subtotal: 20 } },
    })
  })

  it('rejects invalid input with ValidationError', async () => {
    const step = buildStep()

    await expect(
      runStepService(step, { orderId: 1 } as never),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects invalid output with ValidationError', async () => {
    const step = Step.create({
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string() }),
      process: () => ({ id: 1 }) as never,
    })

    await expect(runStepService(step, { id: 'a' })).rejects.toBeInstanceOf(
      ValidationError,
    )
  })

  it('returns success when skip is called', async () => {
    const step = Step.create({
      name: 'skipStep',
      input: z.object({ amount: z.number() }),
      output: z.object({ total: z.number() }),
      process: ({ ctx, skip }) => {
        if (ctx.data.amount === 0) {
          skip('zero amount')
        }
        return { total: ctx.data.amount }
      },
    })

    const result = await runStepService(step, { amount: 0 })

    expect(result).toEqual({
      status: 'success',
      context: { amount: 0 },
      last: undefined,
      reason: 'zero amount',
      step: 'skipStep',
    })
  })

  it('returns success when skip is called without a message', async () => {
    const step = Step.create({
      name: 'skipDefault',
      input: z.object({}),
      output: z.object({}),
      process: ({ skip }) => {
        skip()
      },
    })

    const result = await runStepService(step, {})

    expect(result).toEqual({
      status: 'success',
      context: {},
      last: undefined,
      step: 'skipDefault',
    })
  })

  it('returns success when skipAll is called', async () => {
    const step = Step.create({
      name: 'skipAllStep',
      input: z.object({}),
      output: z.object({ done: z.boolean() }),
      process: ({ skipAll }) => {
        skipAll('stop pipeline')
      },
    })

    const result = await runStepService(step, {})

    expect(result).toEqual({
      status: 'success',
      context: {},
      last: undefined,
      reason: 'stop pipeline',
      step: 'skipAllStep',
    })
  })

  it('returns failed when fail is called and runs inline rollback only', async () => {
    const rollback = vi.fn()
    const inlineRollback = vi.fn()
    const step = Step.create({
      name: 'failStep',
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string() }),
      rollback,
      process: ({ fail }) => {
        fail('boom', { rollback: inlineRollback })
      },
    })

    const result = await runStepService(step, { id: 'x' })

    expect(inlineRollback).toHaveBeenCalledOnce()
    expect(rollback).not.toHaveBeenCalled()
    expect(result.status).toBe('failed')
    if (result.status === 'failed') {
      expect(result.error.message).toBe('boom')
      expect(result.rolledBack).toBe(true)
      expect(result.context).toEqual({ id: 'x' })
    }
  })

  it('returns failed for thrown errors and runs rollback', async () => {
    const rollback = vi.fn()
    const step = Step.create({
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string() }),
      rollback,
      process: () => {
        throw new Error('unexpected')
      },
    })

    const result = await runStepService(step, { id: 'x' })

    expect(rollback).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      status: 'failed',
      rolledBack: true,
      error: { code: 'STEP_ERROR', message: 'unexpected' },
    })
  })

  it('maps structured errors through toActexError', async () => {
    const step = Step.create({
      input: z.object({}),
      output: z.object({}),
      process: () => {
        throw Object.assign(new Error('structured'), {
          code: 'CUSTOM',
          message: 'structured',
        })
      },
    })

    const result = await runStepService(step, {})

    expect(result).toMatchObject({
      status: 'failed',
      error: { code: 'CUSTOM', message: 'structured' },
    })
  })

  it('preserves cause on structured errors', async () => {
    const cause = new Error('inner')
    const step = Step.create({
      input: z.object({}),
      output: z.object({}),
      process: () => {
        throw Object.assign(new Error('structured'), {
          code: 'CUSTOM',
          message: 'structured',
          cause,
        })
      },
    })

    const result = await runStepService(step, {})

    expect(result).toMatchObject({
      status: 'failed',
      error: { code: 'CUSTOM', message: 'structured', cause },
    })
  })

  it('freezes ctx.data during process', async () => {
    const step = Step.create({
      input: z.object({ value: z.number() }),
      output: z.object({ value: z.number() }),
      process: ({ ctx }) => {
        expect(Object.isFrozen(ctx.data)).toBe(true)
        return { value: ctx.data.value }
      },
    })

    await runStepService(step, { value: 1 })
  })
})

describe('createStepService', () => {
  it('returns a step surface with run', async () => {
    const fetchOrder = createStepService({
      name: 'fetchOrder',
      input: z.object({ orderId: z.string() }),
      output: z.object({ order: z.object({ id: z.string() }) }),
      process: ({ ctx }) => ({ order: { id: ctx.data.orderId } }),
    })

    const result = await fetchOrder.run({ orderId: 'ord_123' })

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.context.order.id).toBe('ord_123')
    }
  })

  it('returns success when skipAll is called without a message', async () => {
    const step = Step.create({
      name: 'skipAllDefault',
      input: z.object({}),
      output: z.object({}),
      process: ({ skipAll }) => {
        skipAll()
      },
    })

    const result = await runStepService(step, {})

    expect(result).toEqual({
      status: 'success',
      context: {},
      last: undefined,
      step: 'skipAllDefault',
    })
  })

  it('returns failed without rollback when process throws', async () => {
    const step = Step.create({
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string() }),
      process: () => {
        throw new Error('unexpected')
      },
    })

    const result = await runStepService(step, { id: 'x' })

    expect(result).toMatchObject({
      status: 'failed',
      rolledBack: false,
    })
  })

  it('maps unknown thrown values through toActexError', async () => {
    const step = Step.create({
      input: z.object({}),
      output: z.object({}),
      process: () => {
        throw new Error('plain string')
      },
    })

    const result = await runStepService(step, {})

    expect(result).toMatchObject({
      status: 'failed',
      error: { code: 'STEP_ERROR', message: 'plain string' },
    })
  })

  it('rejects async schema validation', async () => {
    const step = Step.create({
      input: {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: () => Promise.resolve({ value: {} }),
        },
      },
      output: z.object({}),
      process: () => ({}),
    })

    await expect(runStepService(step, {})).rejects.toThrow(
      'actex requires sync validation',
    )
  })

  it('creates surface without rollback when omitted', async () => {
    const instance = Step.create({
      input: z.object({ n: z.number() }),
      output: z.object({ n: z.number() }),
      process: ({ ctx }) => ({ n: ctx.data.n }),
    })

    const surface = createStepSurface(instance)
    expect(surface.rollback).toBeUndefined()
    const result = await surface.run({ n: 5 })

    expect(result.status).toBe('success')
  })

  it('creates surface with rollback when provided', () => {
    const rollback = vi.fn()
    const instance = Step.create({
      input: z.object({ n: z.number() }),
      output: z.object({ n: z.number() }),
      rollback,
      process: ({ ctx }) => ({ n: ctx.data.n }),
    })

    const surface = createStepSurface(instance)
    expect(surface.rollback).toBe(rollback)
  })
})

describe('step signals', () => {
  it('constructs control-flow signal errors', () => {
    expect(new StepFailSignal('fail', { rollback: vi.fn() }).name).toBe(
      'StepFailSignal',
    )
    expect(new StepFailSignal('fail').options).toBeUndefined()
    expect(new StepSkipSignal().message).toBe('skipped')
    expect(new StepSkipAllSignal('all').message).toBe('all')
    expect(new StepSkipAllSignal().message).toBe('skipped all')
    expect(new StepAbortSignal('abort').message).toBe('abort')
  })
})
