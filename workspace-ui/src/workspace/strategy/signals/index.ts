// ── Signals barrel ──
// Sprint 3.4.3 — Signal Engine
//
// @since 3.4.3

export type { SignalDefinition } from './definition/SignalDefinition'
export type { SignalResult, SignalParameter, SignalEvaluationContext } from './types'
export { SignalRegistry } from './registry/SignalRegistry'
export { SignalRuntime } from './runtime/SignalRuntime'
export type { SignalBinding } from './runtime/SignalRuntime'

export { registerAll as registerAllSignals } from './builtins'
