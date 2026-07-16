// ── Drawing builtins barrel ──
// Register all built-in drawing types with the DrawingRegistry.

import { DrawingRegistry } from '../DrawingRegistry'
import { TrendLineDefinition } from './TrendLine'
import { HorizontalLineDefinition } from './HorizontalLine'
import { VerticalLineDefinition } from './VerticalLine'
import { RayDefinition } from './Ray'
import { RectangleDefinition } from './Rectangle'
import { TextDefinition } from './Text'
import { FibonacciDefinition } from './FibonacciRetracement'

const ALL_DRAWING_DEFINITIONS = [
  TrendLineDefinition,
  HorizontalLineDefinition,
  VerticalLineDefinition,
  RayDefinition,
  RectangleDefinition,
  TextDefinition,
  FibonacciDefinition,
] as const

/** Register all built-in drawing definitions with the global DrawingRegistry */
export function registerAllDrawingBuiltins(): void {
  for (const def of ALL_DRAWING_DEFINITIONS) {
    DrawingRegistry.register(def)
  }
}

export {
  TrendLineDefinition,
  HorizontalLineDefinition,
  VerticalLineDefinition,
  RayDefinition,
  RectangleDefinition,
  TextDefinition,
  FibonacciDefinition,
}
