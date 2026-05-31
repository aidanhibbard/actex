# actex — Design Document

**actex** is a typed sequence executor for business processes: checkout, tax, fulfillment. You define **steps** with explicit **input** and **output** shapes, compose **flat sequences**, inject dependencies with **provide**, and extend behavior with **plugins**.

**Runtime:** actex is **isomorphic** — the same core runs in Node (Nitro, workers, BullMQ) and in the browser (Vite, Nuxt client, React/Vue). No Node `EventEmitter`, no `window`/`document`, no framework imports in core. Events use the web-standard **`EventTarget` + `CustomEvent`** bus (same approach as [olallie](https://github.com/aidanhibbard/olallie)).

Inspired by [LightService](https://github.com/adomokos/light-service): **organizers sequence actions; reuse is flattening step lists — not nesting pipelines.**

This document explores **ergonomics** — how the API feels in real TypeScript. It is not an implementation plan.

> **Naming note:** Public API uses `step` / `defineSequence`. Internal classes (`Step`, `Sequence`, `EventBus`) are never exported — factories only (`defineSequence()`, `EventBus.create()`). Repo scaffolding (`AGENTS.md`, spec paths) may still say `workflow`/`action` until aligned.

---

## 1. Overview / mental model

### What you are building

A **step** is one unit of work. A **sequence** is a **flat**, ordered list of steps — one store, one pipeline. Every step is authored identically. Position is the executor’s job, not the author’s.

**LightService rule:** sequences compose **steps**, not other sequences. Reuse = export a step array and splat it in (like `*Organizer.actions` in Ruby).

### Three layers

| Layer | Who sees it | Purpose |
|-------|-------------|---------|
| **store** | Executor, plugins, event listeners | Pipeline bag — shapes merged across steps |
| **ctx.data** | Step `process`, plugins (narrow) | Validated slice matching step **input** shape |
| **provide** | Step `process`, plugins | Injected services (Prisma, logger, config) |

Steps never see the full store. Plugins always receive **ctx + store + provide** at every callback.

### Isomorphic core

| Constraint | Why |
|------------|-----|
| No Node `events`, `fs`, `path`, etc. | Runs in browser bundles |
| No `window`, `document` | Runs on server / workers |
| No framework imports (Vue, React, Nitro) | Host app chooses stack |
| **`EventTarget` + `CustomEvent`** | Web-standard bus — Node 15+ and all modern browsers |
| Standard Schema + plain `Promise` | Works everywhere TS runs |

Validation, execution, rollback, and the **event bus** share one code path in all environments.

### Input and output are shapes

Every step declares **`input`** and **`output`** as **object schemas** — always a shape, never a key list.

```ts
input: z.object({ orderId: z.string() })     // Zod — primary DX in docs/examples
input: v.object({ orderId: v.string() })     // Valibot
input: type({ orderId: 'string' })           // ArkType
input: Type.Object({ orderId: Type.String() }) // TypeBox
// ❌ never: ['order'], [], s(z.object(...))
```

**Runtime contract:** actex consumes **[Standard Schema](https://standardschema.dev)** — any schema with a `~standard.validate()` method. No per-library adapters in the executor.

TypeScript checks each `.step()` so the step’s **input shape** is satisfied by the store built so far (or by `.run(input)` for the first step).

### Sequence bounds: `Ti` and `To`

| Generic | Meaning | Default |
|---------|---------|---------|
| **`Ti`** | Sequence `.run(input)` input — first step’s input shape | Inferred from first `.step()` |
| **`To`** | Sequence result store / output boundary | Inferred from accumulated steps |

```ts
// Inferred — Ti from fetchOrder.input, To from final store after all steps
const checkout = defineSequence()
  .step(fetchOrder)
  .step(calculateTax)

await checkout.run({ orderId: 'ord_123' }) // input: Ti; result.context: To

// Manual — enforce public contract regardless of inner steps
const checkout = defineSequence<
  z.infer<typeof FetchOrderInput>,
  z.infer<typeof CheckoutOutput>
>()
  .step(fetchOrder)
  .step(calculateTax)

await checkout.run({ orderId: 'ord_123' }) // arg must match Ti; result.context must satisfy To
```

### Mental model

```
provide ──► injected into every step/process
.run(Ti) ──► store seeded ──► [step A] ──► store merge A.output shape
                    │ plugins observe ctx + store
                    ▼
              [step B]  ctx.data ← validated B.input shape from store
                    ▼
              result { status, context: To, last?, ... }
```

---

## 2. Quick start

### Standalone step with provide

```ts
import { z } from 'zod'
import { step } from 'actex'

const FetchOrderInput = z.object({ orderId: z.string() })
const FetchOrderOutput = z.object({
  order: z.object({ id: z.string(), subtotal: z.number() }),
})

const fetchOrder = step({
  name: 'fetchOrder',
  input: FetchOrderInput,
  output: FetchOrderOutput,
  process: async ({ ctx, provide }) => {
    const order = await provide.prisma.order.findUniqueOrThrow({
      where: { id: ctx.data.orderId },
    })
    return { order: { id: order.id, subtotal: Number(order.subtotal) } }
  },
})

const result = await fetchOrder.run(
  { orderId: 'ord_123' },
  { provide: { prisma } },
)

if (result.status === 'success') {
  console.log(result.context.order.subtotal)
}
```

### Minimal sequence (inferred `Ti` / `To`)

```ts
import { defineSequence } from 'actex'

const checkout = defineSequence()
  .provide({ prisma, logger, taxEngine })
  .step(fetchOrder)      // Ti ← fetchOrder input
  .step(calculateTax)
  .step(chargePayment)   // To ← accumulated store after last step

const result = await checkout.run({ orderId: 'ord_123' })
//                                ^ Ti inferred
// result.context                 ^ To inferred
```

### Manual sequence bounds

```ts
const CheckoutOutput = z.object({
  order: z.object({ id: z.string(), subtotal: z.number() }),
  tax: z.object({ amount: z.number() }),
  payment: z.object({ id: z.string(), status: z.literal('captured') }),
})

const checkout = defineSequence<
  z.infer<typeof FetchOrderInput>,
  z.infer<typeof CheckoutOutput>
>()
  .step(fetchOrder)
  .step(calculateTax)
  .step(chargePayment)

// ❌ .step(...) that doesn't produce CheckoutOutput → compile error on builder
// ❌ checkout.run({ wrong: 'shape' }) → Ti violation
```

### With plugins

```ts
const checkout = defineSequence()
  .provide({ prisma, logger, audit })
  .use(timingPlugin, auditPlugin)
  .step(fetchOrder)
  .step(calculateTax)

await checkout.run(input)
```

---

## 3. Steps

### Anatomy (same at every position)

```ts
const OrderShape = z.object({
  id: z.string(),
  subtotal: z.number(),
  country: z.string(),
})

const calculateTax = step({
  name: 'calculateTax',
  input: z.object({ order: OrderShape }),
  output: z.object({
    tax: z.object({ rate: z.number(), amount: z.number() }),
  }),
  rollback: async ({ ctx, output, provide }) => {
    if (output?.tax) {
      await provide.audit.log({ event: 'tax_rolled_back', orderId: ctx.data.order.id })
    }
  },
  process: async ({ ctx, provide, fail, skip }) => {
    const { order } = ctx.data

    if (order.subtotal === 0) {
      skip('zero subtotal — no tax')
    }

    const rate = await provide.taxEngine.rateFor(order.country)
    return { tax: { rate, amount: order.subtotal * rate } }
  },
})
```

### Step generics: `step<Ti, To>()`

By default, **`Ti`** and **`To`** on a step are inferred from the schemas you pass — no generics needed.

When you pass them explicitly, the schemas must match:

| Generic | Meaning | Inferred from |
|---------|---------|---------------|
| **`Ti`** | `ctx.data` type | `StandardSchemaV1.InferOutput<input>` |
| **`To`** | `process` return / merged output | `StandardSchemaV1.InferOutput<output>` |

**Zod DX** — explicit generics enforce `ZodType<Ti>` / `ZodType<To>`:

```ts
type FetchOrderInput = { orderId: string }
type FetchOrderOutput = { order: { id: string; subtotal: number } }

const fetchOrder = step<FetchOrderInput, FetchOrderOutput>({
  name: 'fetchOrder',
  input: z.object({ orderId: z.string() }),   // ZodType<FetchOrderInput> ✅
  output: z.object({ order: z.object({ id: z.string(), subtotal: z.number() }) }),
  process: async ({ ctx, provide }) => {
    // ctx.data: FetchOrderInput
    return { order: { id: '…', subtotal: 0 } } // To
  },
})

// ❌ step<FetchOrderInput, FetchOrderOutput>({ input: z.object({ id: z.string() }), ... })
//    — compile error: ZodType doesn't match Ti
```

**Library-agnostic** — same idea via Standard Schema output types:

```ts
import type { StandardSchemaV1 } from '@standard-schema/spec'

step<Ti, To>({
  input: inputSchema as StandardSchemaV1<unknown, Ti>,
  output: outputSchema as StandardSchemaV1<unknown, To>,
  process: ...
})
```

actex validates at runtime with one code path:

```ts
const result = schema['~standard'].validate(value)
if (result.issues) throw new ValidationError(result.issues)
return result.value
```

Both **`input`** and **`output`** are object schemas implementing **Standard Schema**. They define:

| | Role |
|---|------|
| **`input`** | Shape `ctx.data` must satisfy; keys read from store (or `.run(input)` when first) |
| **`output`** | Shape `process` must return; merged into store after validation |

**Empty shape** — use `z.object({})`. Return `{}`. Store unchanged for keys this step adds.

```ts
const pingHealth = step({
  name: 'pingHealth',
  input: z.object({}),
  output: z.object({}),
  process: async ({ provide }) => {
    await provide.logger.info('checkout pipeline alive')
    return {}
  },
})
```

**Output replaces overlapping keys:** returning `{ order: updated }` with `output: z.object({ order: OrderShape })` validates and merges `order`; other store keys persist.

```ts
const applyDiscount = step({
  name: 'applyDiscount',
  input: z.object({
    order: OrderShape,
    coupon: z.object({ amount: z.number() }),
  }),
  output: z.object({ order: OrderShape }),
  process: async ({ ctx }) => ({
    order: {
      ...ctx.data.order,
      subtotal: ctx.data.order.subtotal - ctx.data.coupon.amount,
    },
  }),
})
```

**Mutations:** `ctx.data` is **read-only**. Steps change pipeline state only by **returning output** validated against `output`.

### ctx.data

All step input lives under **`ctx.data`** — typed from the **input shape**.

```ts
process: async ({ ctx }) => {
  ctx.data.order     // ✅ declared on input shape
  ctx.data.customer  // ❌ type error
}
```

### Control flow

| Call | Effect on sequence | Rollback | Result |
|------|-------------------|----------|--------|
| `fail(msg, opts?)` | Stops immediately | Prior **completed** steps’ `rollback` in reverse | `status: 'failed'` |
| `skip(msg?)` | Stops remaining steps **in current scope** | None | `status: 'success'` (optional `reason`) |
| `skipAll(msg?)` | Stops **entire** sequence (like LS `skip_all_remaining!`) | None | `status: 'success'` |
| `fail(..., { rollback: fn })` | Stops | Inline fn first, then prior rollbacks | `status: 'failed'` |

Inside scoped orchestration blocks (`.when()`, `.iterate()`), `skip()` only halts that block’s remaining steps — same as LightService `skip_remaining!` inside `reduce_if` / `iterate`.

`sequence:complete` fires on terminal **`success`** only — not on `failed` or `running`.

### Mixed providers in one sequence

Allowed — each step can use a different library; actex only calls `~standard.validate()`.

```ts
defineSequence()
  .step(step({ input: z.object({ id: z.string() }), output: z.object({ order: OrderShape }), process: ... }))
  .step(step({ input: v.object({ order: v.object({ ... }) }), output: v.object({ tax: v.object({ ... }) }), process: ... }))
  .run(input)
```

See [§9 Schema providers](#9-schema-providers-standard-schema) for the full support matrix.

### Validation failures

`.run(input)` or step input/output shape mismatch throws **`ValidationError`** (promise rejection). Use `try/catch`.

---

## 4. Sequences

### Builder

```ts
const checkout = defineSequence()
  .use(auditPlugin, metricsPlugin)
  .provide({ prisma, logger })
  .step(fetchOrder)
  .step(calculateTax)
  .step(chargePayment)

await checkout.run(input)
```

**`.run(input)`** — executes the sequence. Takes `Ti`, returns `Promise<Result<To>>`. Not curried — no `.run()()` or `.run()`-then-call.

**`.use(plugin, ...plugins)`** — variadic plugins per call; multiple `.use()` calls append. Only way to attach plugins — no global registration.

**`Ti` / `To` inference** — updated on each `.step()`:

```
defineSequence()
  .step(fetchOrder)     // Ti = z.infer<typeof FetchOrderInput>
                        // store = merge({}, fetchOrder.output)
  .step(calculateTax)   // store must satisfy calculateTax.input shape
  .step(chargePayment)   // To = final store type
  .run(input)            // Promise<Result<To>>
```

**Manual bounds** — `defineSequence<Ti, To>()` checks:

1. First step `input` assignable from `Ti` (or equals inferred first input)
2. Final store assignable to `To` after last step
3. `.run(input)` argument typed as `Ti`

```ts
defineSequence<RunInput, PublicOutput>()
  .step(internalFetch)   // must be compatible with Ti at entry
  .step(internalTransform)
  .run(input)            // result.context: PublicOutput
```

### Flat composition (LightService-faithful)

One sequence = one flat `reduce` chain. **No nested sequences. No `.segment()`.** No sub-pipelines that run as a single `.step()` slot.

```ts
const checkout = defineSequence()
  .provide({ prisma, logger })
  .step(fetchOrder)
  .step(resolveJurisdiction)
  .step(calculateTax)
  .step(chargePayment)
```

### Reusing steps — splat, don’t nest

LightService reuse is `*SubOrganizer.actions` — flatten the inner action list into the parent. actex equivalent:

```ts
// tax/steps.ts — export steps, not a runnable sub-sequence
export const taxSteps = [
  resolveJurisdiction,
  calculateTax,
] as const

// checkout.ts
const checkout = defineSequence()
  .step(fetchOrder)
  .steps(...taxSteps)       // splat — same as .step(a).step(b)
  .step(chargePayment)
```

**`.steps(...steps)`** — variadic; type-checks and merges store the same as chaining `.step()` calls. This is the **primary reuse pattern**.

```ts
// equivalent
defineSequence().step(fetchOrder).step(resolveJurisdiction).step(calculateTax).step(chargePayment)
defineSequence().step(fetchOrder).steps(...taxSteps).step(chargePayment)
```

### Context bridging — mapping steps, not nested organizers

When a reused block expects a different store slice, use a **mapping step** (LightService’s `PrepareContextForOrganizerAction` / `execute(->(ctx) { ... })`):

```ts
const prepareTaxContext = step({
  name: 'prepareTaxContext',
  input: z.object({ order: OrderShape, regionCode: z.string() }),
  output: z.object({ order: OrderShape, jurisdiction: z.string() }),
  process: ({ ctx }) => ({
    order: ctx.data.order,
    jurisdiction: ctx.data.regionCode,
  }),
})

defineSequence()
  .step(fetchOrder)
  .step(prepareTaxContext)
  .steps(...taxSteps)
  .step(chargePayment)
  .run(input)
```

### What we intentionally omit

| Pattern | LightService | actex |
|---------|--------------|-------|
| Nested organizer in organizer | Discouraged; deprecation warnings | **Not supported** |
| `Organizer::AsAction` wrapper | Community workaround | **Not supported** — use splat + mapping step |
| Scoped sub-store / output-only merge | N/A (flat context) | **Not supported** — one store for the whole run |
| `.segment()` / nested `.step(sequence)` | N/A | **Removed** |

Need a standalone tax run? Call a **top-level sequence** with `.run(input)` — two `.run(input)` calls, pass context between them. Same as chaining two LS `.call()` invocations.

### Orchestration on the builder (LS parity)

Complexity lives on the **sequence builder**, not in nesting. LightService organizer constructs map to:

| LightService | actex (sketch) |
|--------------|----------------|
| `reduce_if` | `.when(pred, builder => builder.step(...))` |
| `reduce_if_else` | `.whenElse(pred, then, else)` |
| `reduce_case` | `.match(key, cases)` |
| `reduce_until` / `reduce_while` | `.until(pred, ...)` / `.while(pred, ...)` |
| `iterate(:items, [...])` | `.iterate('items', steps)` |
| `execute(->(ctx) { ... })` | mapping `step` or inline `.tap(fn)` |
| `add_to_context` | `.provideContext({ key: value })` |
| `add_aliases` | mapping step or plugin |

Orchestration blocks share the **same flat store**. `skip()` inside a block is scoped; `skipAll()` halts the whole sequence.

### Store carry-forward

Store merges validated **output shapes** step by step. Keys not in a step’s output shape **persist**.

```
After fetchOrder:      { order }
After calculateTax:    { order, tax }
After applyDiscount:   { order, tax, coupon }
After chargePayment:   { order, tax, coupon, payment }
```

### Compile-time errors

Shape mismatch at `.step()`:

```
StepContractViolation: step "chargePayment" input requires { order, tax }
  but store is { order }
  at .step(chargePayment)
```

`.run(input)` fields not declared on the first step **input shape** are **stripped** before store seed.

---

## 5. Provide / injectables

```ts
type CheckoutProvide = {
  prisma: PrismaClient
  logger: Logger
  taxEngine: TaxEngine
}

const checkout = defineSequence<z.infer<typeof FetchOrderInput>, z.infer<typeof CheckoutOutput>, CheckoutProvide>()
  .provide({ prisma, logger, taxEngine })
  .step(fetchOrder)

await checkout.run(input)
```

Standalone: `step.run(input, { provide: { prisma } })`.

**Step-level fallback:** `defaultProvide` on reusable library steps; sequence `.provide()` wins on collision.

---

## 6. Plugins

Not hooks. **`definePlugin`** with **flat event keys** + optional **`wrapStep`**. No `api.on` nesting.

Under the hood, every plugin event goes through a **run-scoped `EventBus` class** — OOP wrapper around web-standard `EventTarget` + `CustomEvent` (same mechanism as [olallie](https://github.com/aidanhibbard/olallie)). Plugin handlers, builder `.on()` listeners, and `wrapStep` all attach to the same bus for that `.run(input)` call.

### Event bus — `EventBus` (internal class)

Implementation is **OOP**: a `final` class owns the target; **services** implement behavior; the class is **never exported**. Consumers only see `definePlugin` / `.on()` / `defineSequence`.

Each `.run(input)` calls **`EventBus.create()`**. Subscriptions are dropped when the run finishes — no cross-run leaks, safe for concurrent server requests and client-side re-runs.

```
.run(input)
  └── EventBus.create()          // lib/classes/event-bus.ts — not exported
        ├── private readonly target: EventTarget
        ├── public readonly listen   ← listenService
        ├── public readonly dispatch ← dispatchService
        ├── public readonly mount    ← mountPluginService
        └── mount sequence plugins (.use) + builder .on() listeners
              └── dispatch(type, payload) → CustomEvent on target
                    └── dispatchService awaits async handlers after sync dispatch
```

| Property | Value |
|----------|-------|
| **Scope** | One `EventBus` per run |
| **Class** | `final`, private constructor, `public static create()` |
| **Surface** | Readonly service bindings — class does not implement logic inline |
| **Private state** | `private readonly target: EventTarget` |
| **Dispatch** | `dispatchService` → `target.dispatchEvent(new CustomEvent(type, { detail }))` |
| **Registration** | `listenService` → `target.addEventListener`; returns `{ unlisten }` |
| **Runtime** | Web-standard `EventTarget` / `CustomEvent` inside the class — not Node `events` |
| **Exported?** | **No** — `Sequence` holds an `EventBus`; public API stays functional |

```ts
// lib/classes/event-bus.ts — internal sketch, not exported
final class EventBus {
  private readonly target: EventTarget

  private constructor() {
    this.target = new EventTarget()
  }

  public static create(): EventBus

  public readonly listen = listenService
  public readonly dispatch = dispatchService
  public readonly mount = mountPluginService
}

// lib/services/event-bus/dispatch.ts
export const dispatchService = async (
  bus: EventBus,
  type: PluginEventName,
  payload: PluginPayload,
): Promise<void> => { /* dispatchEvent + await async listeners */ }
```

**Typed events** — `PluginEvent<K>` extends `CustomEvent` with typed `detail` (olallie `StoreEvent` pattern):

```ts
type PluginEvent<K extends PluginEventName> = CustomEvent & {
  detail: PluginPayload // meta narrows per K at usage sites
}
```

`definePlugin` event keys are **mounted** via `mountPluginService` at run start. Handlers receive `event.detail`; plugin docs show the unwrapped `{ ctx, env, meta }` destructuring shape.

**Async handlers** — `EventTarget` dispatch is synchronous. `dispatchService` wraps listeners: if a handler returns a `Promise`, collect and `await` after `dispatchEvent` before the executor continues.

### Event registration — flat on the plugin

Events are **top-level keys** on the plugin object (siblings of `name` and `wrapStep`). Easier to grep, extend, and type than nested `api.on`.

```ts
const sentry = definePlugin({
  name: 'sentry',

  'step:fail': ({ ctx, env, meta }) => {
    env.provide.sentry.captureException(meta.error, {
      step: meta.step.name,
      store: env.store,
      data: ctx?.data,
    })
  },

  'step:before': ({ ctx, env, meta }) => {
    env.provide.sentry.addBreadcrumb({ message: meta.step.name })
  },
})
```

### Payload — one object, destructure what you need

Every handler receives **one argument**. Destructuring keeps handlers small and lets each event grow **`meta`** without breaking callers.

```ts
type PluginPayload = {
  /** Step slice — same narrowed view as `process`; `undefined` on terminal sequence events */
  ctx: { data: unknown } | undefined
  /** Runtime bag — always present */
  env: {
    store: unknown
    provide: Record<string, unknown>
  }
  /** Event-specific fields — grows per event type */
  meta: PluginEventMeta
}
```

| Event key | `meta` includes |
|-----------|-----------------|
| `sequence:start` | `{ input }` |
| `step:before` / `step:after` | `{ step }` |
| `step:fail` | `{ step, error }` |
| `step:skip` | `{ step, reason? }` |
| `sequence:complete` | `{ context }` |
| `sequence:error` | `{ error, step? }` |

| Event key | When |
|-----------|------|
| `sequence:start` | Before step 1 |
| `step:before` / `step:after` | Around step `process` |
| `step:fail` / `step:skip` | Step control flow |
| `sequence:complete` | Terminal `success` |
| `sequence:error` | Uncaught throw |

Handlers only destructure what they use:

```ts
'step:fail': ({ env: { provide }, meta: { step, error } }) => {
  provide.audit.record('fail', { code: error.code, step: step.name })
}

'sequence:complete': ({ env: { store } }) => {
  provide.metrics.increment('sequence.success')
}
```

### Full plugin example

```ts
const auditPlugin = definePlugin({
  name: 'audit',

  'step:before': ({ ctx, env, meta }) => {
    env.provide.logger.debug(`before ${meta.step.name}`, {
      data: ctx?.data,
      store: env.store,
    })
  },

  'step:fail': ({ env, meta }) => {
    env.provide.audit.record('fail', {
      code: meta.error.code,
      step: meta.step.name,
    })
  },

  wrapStep: (stepDef, { abort }) => ({
    ...stepDef,
    process: async (args) => {
      const timer = setTimeout(() => abort('timeout'), 30_000)
      try {
        return await stepDef.process(args)
      } finally {
        clearTimeout(timer)
      }
    },
  }),
})
```

### Control flow — plugins vs steps

| Mechanism | Who | Result |
|-----------|-----|--------|
| `fail()` / `skip()` | Step only | `status: 'failed'` / `'success'`; fires `step:fail` / `step:skip` |
| `throw` | Step or plugin | `status: 'failed'`; `sequence:error`; may rollback if step had started |
| `abort(reason)` | `wrapStep` only | `status: 'failed'`; structured external cancel |

Plugins **cannot** call `fail` or `skip`. Steps own control flow.

### Attach

Plugins attach **only** via `.use()` on a sequence builder. No global registry, no `actex.*` namespace — named exports only (`step`, `defineSequence`, `definePlugin`).

```ts
defineSequence().use(auditPlugin, timingPlugin).step(...).run(input)
```

**Reuse across routes** — bake plugins into a shared builder in *your* app (not actex globals):

```ts
// server/utils/sequence.ts
export const sequence = defineSequence().use(sentry, auditPlugin)

// handler
await sequence().step(myStep).run(input)
```

### Ad-hoc listeners — `.on()`

For one-off observation (progress UI, devtools, tests) without a full plugin:

```ts
await defineSequence()
  .step(fetchOrder)
  .step(chargePayment)
  .on('step:before', ({ meta }) => {
    console.log('running', meta.step.name)
  })
  .run(input)
```

Same payload as plugin handlers. `.on()` registers via `EventBus.listen` alongside plugins. Supports multiple listeners per event and optional [listener options](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#options) (`once`, `signal`, etc.) passthrough.

### Client example — checkout progress

```ts
// Vue / Nuxt client — same API as server
const activeStep = ref<string | null>(null)

const result = await checkout
  .on('step:before', ({ meta }) => { activeStep.value = meta.step.name })
  .on('sequence:complete', () => { activeStep.value = null })
  .run({ orderId, paymentMethodId })
```

No separate client build. UI subscribes via the same `EventBus` the server uses for audit/Sentry.

---

## 7. store vs ctx vs provide

| | store | ctx.data | provide |
|---|-------|----------|---------|
| Visibility | Plugins, `result.context` (`To`) | Step process | Step process |
| Shape | Accumulated output shapes | Current step **input shape** | Injected services |
| Mutability | Executor merge | Read-only | Read-only refs |

**Rule:** pipeline **data** → store, read via **input shape** as `ctx.data`. **Infrastructure** → **provide**.

---

## 8. Error handling & rollback

### Result

Three statuses only: **`success`**, **`failed`**, **`running`**.

```ts
type Result<TContext> =
  | { status: 'success'; context: TContext; last: unknown; reason?: string; step?: string }
  | { status: 'failed'; context: TContext; error: ActexError; rolledBack: boolean }
  | { status: 'running'; context: TContext; step?: string }
```

| Status | When |
|--------|------|
| **`success`** | Sequence finished — all steps ran, or a step called `skip()` (use `reason` / `step` for early exit) |
| **`failed`** | `fail()`, `throw`, `abort()`, or validation error after rollbacks |
| **`running`** | In-flight — emitted on the run-scoped bus while steps execute; `.run(input)` resolves to `success` or `failed` only |

- **`context`** — full store at that point (`To` on terminal `success`)
- **`last`** — final step’s validated output (terminal `success` only)

### Rollback example

```ts
const reserveInventory = step({
  name: 'reserveInventory',
  input: z.object({ order: OrderShape }),
  output: z.object({ reservation: z.object({ id: z.string() }) }),
  rollback: async ({ output, provide }) => {
    if (output?.reservation) {
      await provide.inventory.release(output.reservation.id)
    }
  },
  process: async ({ ctx, provide, fail }) => {
    const reservation = await provide.inventory.reserve(ctx.data.order.items)
    return { reservation }
  },
})
```

**Skip** halts remaining steps; no rollback. Result is **`success`** with optional `reason` / `step`.

---

## 9. Schema providers (Standard Schema)

The spec you are thinking of is **[Standard Schema](https://standardschema.dev)** (`@standard-schema/spec`) — not OpenAPI, not JSON Schema alone, not schema.org. Designed by the Zod, Valibot, and ArkType authors so ecosystem tools accept **one** schema shape.

### Three interfaces (one package)

| Spec | Property | actex uses it for |
|------|----------|-------------------|
| **StandardTypedV1** | `~standard.types` | `InferInput` / `InferOutput` at compile time |
| **StandardSchemaV1** | `~standard.validate()` | Runtime validation of `.run(input)`, step input, step output |
| **StandardJSONSchemaV1** | `~standard.jsonSchema` | Future: OpenAPI / MCP tool defs from step contracts |

actex depends on **`@standard-schema/spec`** as a runtime dependency (types become part of our public API, per spec FAQ).

### Native implementers (first-class)

These expose `~standard` on schema objects — use directly in `input` / `output`:

| Library | Min version | Notes |
|---------|-------------|-------|
| **Zod** | 3.24+ / 4.x | Primary DX in docs; `step<Ti, To>()` → `ZodType<Ti>`, `ZodType<To>` |
| **Valibot** | 0.31+ / 1.x | Async `validate` supported by spec |
| **ArkType** | 2.0+ | Can embed other Standard Schema schemas |
| **Effect Schema** | 3.10+ | Typed errors, transforms |
| **Yup** | 1.6+ | Legacy form stacks |
| **Typia** | 7.3+ | Build-time validation; runtime still exposes `~standard` |

### TypeBox — via TypeMap, not native

TypeBox builds **JSON Schema objects** — it does not carry a validator on the type itself. Sinclair’s position: Standard Schema integration for TypeBox goes through **[TypeMap](https://github.com/sinclairzx81/typemap)** (`Compile()`), which returns a compiled validator with `~standard.validate()`.

```ts
import { Compile } from '@sinclair/typemap'
import Type from 'typebox'

const OrderInput = Compile(Type.Object({ orderId: Type.String() }))
// OrderInput['~standard'].validate(...)

step({
  input: OrderInput,
  output: Compile(Type.Object({ order: Type.Object({ ... }) })),
  process: ...
})
```

TypeMap also translates between Zod ↔ Valibot ↔ TypeBox and compiles all three on TypeBox infrastructure.

### What actex does *not* ship

- No `s(z.object())` adapter wrappers
- No Ajv / `@cfworker/json-schema` adapters in core (users can wrap JSON Schema → Standard Schema themselves)
- No requirement that all steps in a sequence use the same library
- No global plugin registry or `actex.registerPlugin()` — attach with `.use()` only
- No `actex.*` namespace export — `step`, `defineSequence`, `definePlugin` as named exports

### Executor validation (internal)

```ts
import type { StandardSchemaV1 } from '@standard-schema/spec'

const parse = <T>(schema: StandardSchemaV1<unknown, T>, value: unknown): T => {
  const result = schema['~standard'].validate(value)
  if (result instanceof Promise) throw new TypeError('actex requires sync validation')
  if (result.issues) throw new ValidationError(result.issues)
  return result.value
}
```

---

## 10. LightService mapping

| LightService | actex |
|--------------|-------|
| Action | `step()` |
| Organizer | `defineSequence()` |
| `expects` | `input` shape |
| `promises` | `output` shape |
| Context | `store` (full) + `ctx.data` (step slice) |
| `Organizer.actions` / `*actions` splat | exported step array + `.steps(...)` |
| Nested organizer | **Not supported** — splat steps instead |
| Mapping / `execute` lambda | mapping `step` |
| `reduce_if`, `iterate`, … | builder orchestration (`.when`, `.iterate`, …) |
| `skip_remaining!` / `skip_all_remaining!` | `skip()` / `skipAll()` |
| `fail!` / `fail_and_return!` | `fail()` |
| `before_actions` / `after_actions` / `around_each` | `definePlugin` events + `wrapStep` (via run-scoped `EventBus`) |
| `aliases` | mapping step or plugin |

---

## 11. API sketch (types only)

```ts
import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { ZodType } from 'zod'

// Inferred Ti/To from schemas (any Standard Schema provider)
declare const step: <
  TInputSchema extends StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1,
  TProvide = Record<string, unknown>,
>(
  def: {
    name?: string
    input: TInputSchema
    output: TOutputSchema
    defaultProvide?: Partial<TProvide>
    rollback?: RollbackFn<
      StandardSchemaV1.InferOutput<TInputSchema>,
      StandardSchemaV1.InferOutput<TOutputSchema>,
      TProvide
    >
    process: ProcessFn<
      StandardSchemaV1.InferOutput<TInputSchema>,
      StandardSchemaV1.InferOutput<TOutputSchema>,
      TProvide
    >
  },
) => Step<
  StandardSchemaV1.InferOutput<TInputSchema>,
  StandardSchemaV1.InferOutput<TOutputSchema>,
  TProvide
>

// Explicit Ti/To — Zod path enforces ZodType<Ti> / ZodType<To>
declare function step<Ti, To, TProvide = Record<string, unknown>>(
  def: {
    name?: string
    input: ZodType<Ti>
    output: ZodType<To>
    defaultProvide?: Partial<TProvide>
    rollback?: RollbackFn<Ti, To, TProvide>
    process: ProcessFn<Ti, To, TProvide>
  },
): Step<Ti, To, TProvide>

declare const defineSequence: <
  Ti = unknown,
  To = unknown,
  TProvide = Record<string, unknown>,
>() => SequenceBuilder<Ti, To, TProvide>

type SequenceBuilder<Ti, To, TProvide> = {
  provide(deps: TProvide): SequenceBuilder<Ti, To, TProvide>
  use(...plugins: Plugin[]): SequenceBuilder<Ti, To, TProvide>
  on(event: PluginEventName, handler: PluginEventHandler): SequenceBuilder<Ti, To, TProvide>
  step<S extends Step<any, any, TProvide>>(s: S): SequenceBuilder<
    Ti extends unknown ? StepInput<S> : Ti,
    MergeStore<To, StepOutput<S>>,
    TProvide
  >
  steps<S extends Step<any, any, TProvide>[]>(
    ...steps: S
  ): FoldSteps<SequenceBuilder<Ti, To, TProvide>, S>
  run(input: Ti): Promise<Result<To>>
}

// Internal — not exported
type PluginEvent<K extends PluginEventName = PluginEventName> = CustomEvent & {
  detail: PluginPayload
}

// EventBus.create() per .run(input) — class never exported; see §6

declare const definePlugin: <T extends PluginDef>(def: T) => Plugin<T>

type PluginDef = {
  name: string
  wrapStep?: WrapStepFn
} & Partial<Record<PluginEventName, PluginEventHandler>>

type PluginEventHandler = (payload: PluginPayload) => void | Promise<void>

// Package exports: step, defineSequence, definePlugin — named only; no actex.* namespace
```

---

## Design notes

**LightService-faithful composition** — flat sequences only; reuse via exported step arrays + `.steps(...)` splat; mapping steps for context bridging; no nested sequences or segments.

**Standard Schema** — single runtime contract via `~standard.validate()`; Zod/Valibot/ArkType/Effect/Yup/Typia native; TypeBox via TypeMap `Compile()`.

**Shapes only** — no key-array contracts; input/output are always object schemas.

**Ti / To** — inferred from schemas by default; `step<Ti, To>()` enforces `ZodType<Ti>`/`ZodType<To>` (Zod) or `StandardSchemaV1<unknown, Ti>` (agnostic); `defineSequence<Ti, To>()` enforces sequence boundaries.

**ctx.data** — single namespace; typed from input shape.

**No global attach** — plugins and listeners are sequence-scoped (`.use()`, `.on()`). No `registerPlugin`, no `actex.*` object.

**OOP + olallie mechanism** — internal `EventBus` class (`final`, not exported) wraps `EventTarget` + `CustomEvent`. Services (`listen`, `dispatch`, `mount`) are the class surface; one bus per `.run(input)`.

**Flat plugin events** — `'step:fail': ({ ctx, env, meta }) => …` on the plugin object; no `api.on`. Payload is one destructurable object; `meta` grows per event.


## Nitro (server)

```ts
// server/plugins/sentry.ts
const sentry = definePlugin({
  name: 'sentry',

  'step:fail': ({ ctx, env, meta }) => {
    env.provide.sentry.captureException(meta.error.message, {
      step: meta.step.name,
      ctx: ctx,
    })
  },
})

// server/utils/sequence.ts
export const sequence = defineSequence().use(sentry)
```

```ts
export default defineEventHandler(async (event) => {
  const result = await sequence()
    .provide({ prisma: event.context.prisma })
    .step(myStep)
    .run(await readBody(event))

  if (result.status === 'failed') {
    throw createError({ code: 500, message: result.error.message })
  }

  return result.context
})
```

---
