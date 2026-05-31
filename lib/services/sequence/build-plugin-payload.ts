import type { PluginPayload } from '../../types/plugin-payload'
import type { PluginEventMeta } from '../../types/plugin-event-meta'
import type { StepHandle } from '../../interfaces/step-handle'

export const buildPluginPayload = (options: {
  readonly ctxData?: unknown
  readonly store: unknown
  readonly provide: Record<string, unknown>
  readonly meta: PluginEventMeta
}): PluginPayload => ({
  ctx: options.ctxData === undefined ? undefined : { data: options.ctxData },
  env: {
    store: options.store,
    provide: options.provide,
  },
  meta: options.meta,
})

export const buildStepMeta = (handle: StepHandle): PluginEventMeta => ({
  step: { name: handle.name },
})
