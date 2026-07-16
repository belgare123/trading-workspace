/**
 * builtins/index.ts — barrel for built-in indicator definitions
 *
 * @since 3.3.3
 */

export { SMA } from './SMA'
export { EMA } from './EMA'
export { VWAP } from './VWAP'
export { RSI } from './RSI'
export { MACD } from './MACD'

import { IndicatorRegistry } from '../IndicatorRegistry'
import { SMA } from './SMA'
import { EMA } from './EMA'
import { VWAP } from './VWAP'
import { RSI } from './RSI'
import { MACD } from './MACD'

/** Register all built-in indicators */
export function registerBuiltinIndicators(): void {
  IndicatorRegistry.register(SMA)
  IndicatorRegistry.register(EMA)
  IndicatorRegistry.register(VWAP)
  IndicatorRegistry.register(RSI)
  IndicatorRegistry.register(MACD)
}
