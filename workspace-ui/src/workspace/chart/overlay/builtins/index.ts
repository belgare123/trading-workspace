// ── Overlay builtins barrel ──
// Registers all built-in overlay definitions with OverlayRegistry.
//
// @since 3.3.6

import { OverlayRegistry } from '../OverlayRegistry'

// Core (Sprint 3.3.6)
import { priceMarkerDefinition } from './trading/PriceLevelOverlay'
import { orderMarkerDefinition } from './trading/OrderOverlay'
import { positionMarkerDefinition } from './trading/PositionOverlay'
import { executionMarkerDefinition } from './trading/ExecutionOverlay'
import { alertMarkerDefinition } from './market/EventOverlay'
import { volumeProfileDefinition } from './analysis/VolumeProfileOverlay'
import { sessionBoxDefinition } from './analysis/SessionOverlay'

// Trading (Sprint 3.3.8)
import { stopLossDefinition } from './trading/StopLossOverlay'
import { takeProfitDefinition } from './trading/TakeProfitOverlay'
import { pendingOrderDefinition } from './trading/PendingOrderOverlay'
import { liquidationPriceDefinition } from './trading/LiquidationPriceOverlay'
import { bracketOrderDefinition } from './trading/BracketOrderOverlay'

// Analysis (Sprint 3.3.8)
import { valueAreaDefinition } from './analysis/ValueAreaOverlay'
import { vwapBandDefinition } from './analysis/VWAPBandOverlay'
import { openingRangeDefinition } from './analysis/OpeningRangeOverlay'
import { initialBalanceDefinition } from './analysis/InitialBalanceOverlay'
import { volumeNodesDefinition } from './analysis/VolumeNodesOverlay'
import { anchoredVWAPDefinition } from './analysis/AnchoredVWAPOverlay'

// Market (Sprint 3.3.8)
import { newsEventDefinition } from './market/NewsEventOverlay'
import { economicCalendarDefinition } from './market/EconomicCalendarOverlay'
import { earningsDefinition } from './market/EarningsOverlay'
import { dividendSplitDefinition } from './market/DividendSplitOverlay'
import { fundingRateDefinition } from './market/FundingRateOverlay'

// Trading — stateful / computational (Sprint 3.3.8)
import { trailingStopDefinition } from './trading/TrailingStopOverlay'
import { riskRewardDefinition } from './trading/RiskRewardOverlay'

const BUILTINS = [
  // Core (7)
  priceMarkerDefinition,
  orderMarkerDefinition,
  positionMarkerDefinition,
  alertMarkerDefinition,
  executionMarkerDefinition,
  volumeProfileDefinition,
  sessionBoxDefinition,
  // Trading (5)
  stopLossDefinition,
  takeProfitDefinition,
  pendingOrderDefinition,
  liquidationPriceDefinition,
  bracketOrderDefinition,
  // Analysis (6)
  valueAreaDefinition,
  vwapBandDefinition,
  openingRangeDefinition,
  initialBalanceDefinition,
  volumeNodesDefinition,
  anchoredVWAPDefinition,
  // Market (5)
  newsEventDefinition,
  economicCalendarDefinition,
  earningsDefinition,
  dividendSplitDefinition,
  fundingRateDefinition,
  // Trading — stateful / computational (2)
  trailingStopDefinition,
  riskRewardDefinition,
] as const

/** Register all built-in overlay definitions. Idempotent. */
export function registerAllOverlayBuiltins(): void {
  for (const def of BUILTINS) {
    // Guard: skip if already registered (idempotent)
    if (OverlayRegistry.get(def.id)) continue
    OverlayRegistry.register(def)
  }
}
