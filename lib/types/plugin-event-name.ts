export type PluginEventName =
  | 'sequence:start'
  | 'step:before'
  | 'step:after'
  | 'step:fail'
  | 'step:skip'
  | 'sequence:complete'
  | 'sequence:error'
