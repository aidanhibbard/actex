import type { PluginDef } from './interfaces/plugin-def'

export const definePlugin = <T extends PluginDef>(definition: T): T =>
  definition
