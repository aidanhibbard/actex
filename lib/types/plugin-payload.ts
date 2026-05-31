import type { PluginEventMeta } from './plugin-event-meta'

export type PluginPayload = {
  readonly ctx: { readonly data: unknown } | undefined
  readonly env: {
    readonly store: unknown
    readonly provide: Record<string, unknown>
  }
  readonly meta: PluginEventMeta
}
