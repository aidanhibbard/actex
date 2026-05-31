import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { step, type StepSurface } from '../../lib/step'
import { ValidationError } from '../../lib/classes/validation-error'

describe('step factory', () => {
  it('creates a reusable step with inferred schemas', async () => {
    const fetchOrder = step<
      { orderId: string },
      { order: { id: string; subtotal: number } },
      {
        prisma: {
          order: {
            findUniqueOrThrow: (args: {
              where: { id: string }
            }) => Promise<{ id: string; subtotal: string }>
          }
        }
      }
    >({
      name: 'fetchOrder',
      input: z.object({ orderId: z.string() }),
      output: z.object({
        order: z.object({ id: z.string(), subtotal: z.number() }),
      }),
      process: async ({ ctx, provide }) => {
        const order = await provide.prisma.order.findUniqueOrThrow({
          where: { id: ctx.data.orderId },
        })
        return {
          order: { id: order.id, subtotal: Number(order.subtotal) },
        }
      },
    })

    const prisma = {
      order: {
        findUniqueOrThrow: vi.fn(() =>
          Promise.resolve({ id: 'ord_123', subtotal: '42' }),
        ),
      },
    }

    const result = await fetchOrder.run(
      { orderId: 'ord_123' },
      { provide: { prisma } },
    )

    expect(result).toEqual({
      status: 'success',
      context: {
        orderId: 'ord_123',
        order: { id: 'ord_123', subtotal: 42 },
      },
      last: { order: { id: 'ord_123', subtotal: 42 } },
    })
  })

  it('uses defaultProvide when runtime provide is omitted', async () => {
    const info = vi.fn()
    const ping = step({
      name: 'pingHealth',
      input: z.object({}),
      output: z.object({}),
      defaultProvide: {
        logger: { info },
      },
      process: async ({ provide }) => {
        await provide.logger.info('alive')
        return {}
      },
    })

    const result = await ping.run({})

    expect(result.status).toBe('success')
    expect(info).toHaveBeenCalledWith('alive')
  })

  it('prefers runtime provide over defaultProvide', async () => {
    const resolveLabel = step<
      { label: string },
      { label: string },
      { label: string }
    >({
      input: z.object({ label: z.string() }),
      output: z.object({ label: z.string() }),
      defaultProvide: { label: 'default' },
      process: ({ provide }) => ({ label: provide.label }),
    })

    const result = await resolveLabel.run(
      { label: 'input' },
      { provide: { label: 'runtime' } },
    )

    expect(result).toMatchObject({
      status: 'success',
      context: { label: 'runtime' },
    })
  })

  it('exposes process for sequence execution', async () => {
    const myStep = step({
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string() }),
      process: ({ ctx }) => ({ id: ctx.data.id }),
    })

    await expect(
      myStep.process({
        ctx: { data: { id: 'direct' } },
        provide: {},
        fail: () => {
          throw new Error('fail')
        },
        skip: () => {
          throw new Error('skip')
        },
        skipAll: () => {
          throw new Error('skipAll')
        },
      }),
    ).resolves.toEqual({ id: 'direct' })
  })

  it('exposes the public step surface shape', () => {
    const input = z.object({ id: z.string() })
    const output = z.object({ id: z.string() })
    const myStep: StepSurface<
      { id: string },
      { id: string },
      Record<string, never>
    > = step({
      name: 'surface',
      input,
      output,
      process: ({ ctx }) => ({ id: ctx.data.id }),
    })

    expect(myStep.name).toBe('surface')
    expect(myStep.input).toBe(input)
    expect(myStep.output).toBe(output)
    expect(typeof myStep.run).toBe('function')
  })

  it('supports rollback on failure paths', async () => {
    const rollback = vi.fn()
    const release = vi.fn<(id: string) => Promise<void>>()
    const reserve = step<
      { order: { id: string } },
      { reservation: { id: string } },
      { inventory: { release: (id: string) => Promise<void> } }
    >({
      name: 'reserveInventory',
      input: z.object({ order: z.object({ id: z.string() }) }),
      output: z.object({ reservation: z.object({ id: z.string() }) }),
      rollback: async ({ output, provide }) => {
        if (output?.reservation) {
          await provide.inventory.release(output.reservation.id)
        }
      },
      process: ({ fail }) => {
        fail('reserve failed')
      },
    })

    const provide = {
      inventory: { release },
    }

    const result = await reserve.run({ order: { id: 'ord_1' } }, { provide })

    expect(result.status).toBe('failed')
    expect(rollback).not.toHaveBeenCalled()
  })

  it('rejects invalid run input', async () => {
    const strict = step({
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string() }),
      process: ({ ctx }) => ({ id: ctx.data.id }),
    })

    await expect(strict.run({ id: 1 } as never)).rejects.toBeInstanceOf(
      ValidationError,
    )
  })
})
