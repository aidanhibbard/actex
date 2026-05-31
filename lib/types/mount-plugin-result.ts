import type { WrapStepFn } from './wrap-step-fn'

export type MountPluginResult = {
  readonly wrapStep?: WrapStepFn
  readonly unmount: () => void
}
