# actex

Typed sequence executor for business processes — flat steps, schema-checked input/output, rollback, and plugins. Same API on server and client.

## Install

```bash
npm install actex
```

Peer dependency: any [Standard Schema](https://standardschema.dev) library (e.g. Zod 3.24+).

## Quick start

```ts
import { z } from 'zod'
import { defineSequence, step } from 'actex'

const fetchOrder = step({
  name: 'fetchOrder',
  input: z.object({ orderId: z.string() }),
  output: z.object({ order: z.object({ id: z.string(), total: z.number() }) }),
  process: async ({ ctx, provide }) => {
    const order = await provide.prisma.order.findUniqueOrThrow({
      where: { id: ctx.data.orderId },
    })
    return { order: { id: order.id, total: Number(order.total) } }
  },
})

const checkout = defineSequence().provide({ prisma }).step(fetchOrder)

const result = await checkout.run({ orderId: 'ord_123' })
```

## API

| Export | Purpose |
|--------|---------|
| `step()` | Define a step with `input` / `output` schemas and `process` |
| `defineSequence()` | Build a flat pipeline — `.provide()`, `.use()`, `.on()`, `.step()`, `.run(input)` |
| `definePlugin()` | Attach flat event handlers and optional `wrapStep` |

No global registry. No `actex.*` namespace.

## Development

```bash
npm install
npm run test        # vitest + 100% coverage
npm run typecheck
npm run lint
npm run build
```

See [design.md](./design.md) for the full API design.
