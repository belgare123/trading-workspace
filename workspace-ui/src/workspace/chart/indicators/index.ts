/**
 * indicators/index.ts — barrel for Indicator Engine
 *
 * Exports all indicator infrastructure types and the
 * builtins registration function.
 *
 * @since 3.3.3
 */

export type { IndicatorDefinition, IndicatorParamType, IndicatorParam, IndicatorOutput } from './IndicatorDefinition'

export { IndicatorRegistry } from './IndicatorRegistry'
export { IndicatorInstance } from './IndicatorInstance'
export { IndicatorRuntime } from './IndicatorRuntime'
export { IndicatorRenderer } from './IndicatorRenderer'

export { registerBuiltinIndicators } from './builtins/index'
