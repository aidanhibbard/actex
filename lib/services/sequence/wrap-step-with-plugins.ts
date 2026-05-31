import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { StepDef } from '../../interfaces/step-def'
import type { StepHandle } from '../../interfaces/step-handle'
import type { MountPluginResult } from '../../types/mount-plugin-result'
import { StepAbortSignal } from '../../classes/step-signals'

type AnyStep = StepHandle

type RuntimeStepDef = StepDef<StandardSchemaV1, StandardSchemaV1>

const toStepDef = (handle: AnyStep): RuntimeStepDef => ({
  name: handle.name,
  input: handle.input,
  output: handle.output,
  process: handle.process,
  ...(handle.rollback !== undefined ? { rollback: handle.rollback } : {}),
})

const fromStepDef = (definition: RuntimeStepDef, handle: AnyStep): AnyStep => ({
  name: definition.name ?? handle.name,
  input: definition.input,
  output: definition.output,
  process: definition.process,
  ...(definition.rollback !== undefined
    ? { rollback: definition.rollback }
    : handle.rollback !== undefined
      ? { rollback: handle.rollback }
      : {}),
})

export const wrapStepWithPlugins = (
  handle: AnyStep,
  mounts: readonly MountPluginResult[],
): AnyStep => {
  let definition = toStepDef(handle)

  for (const mount of mounts) {
    if (mount.wrapStep !== undefined) {
      definition = mount.wrapStep(definition, {
        abort: (reason) => {
          throw new StepAbortSignal(reason)
        },
      })
    }
  }

  return fromStepDef(definition, handle)
}
