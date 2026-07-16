// ── Overlay builtins barrel ──
// Registers all built-in overlay definitions with OverlayRegistry.
//
// @since 3.3.6

import { OverlayRegistry } from '../OverlayRegistry'
import { priceMarkerDefinition } from './PriceMarker'
import { orderMarkerDefinition } from './OrderMarker'
import { positionMarkerDefinition } from './PositionMarker'
import { alertMarkerDefinition } from './AlertMarker'
import { executionMarkerDefinition } from './ExecutionMarker'
import { volumeProfileDefinition } from './VolumeProfile'
import { sessionBoxDefinition } from './SessionBox'

const BUILTINS = [
  priceMarkerDefinition,
  orderMarkerDefinition,
  positionMarkerDefinition,
  alertMarkerDefinition,
  executionMarkerDefinition,
  volumeProfileDefinition,
  sessionBoxDefinition,
] as const

/** Register all built-in overlay definitions. Idempotent. */
export function registerAllOverlayBuiltins(): void {
  for (const def of BUILTINS) {
    // Guard: skip if already registered (idempotent)
    if (OverlayRegistry.get(def.id)) continue
    OverlayRegistry.register(def)
  }
}
