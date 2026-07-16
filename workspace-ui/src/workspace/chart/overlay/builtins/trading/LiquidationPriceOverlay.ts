// ── LiquidationPriceOverlay — liquidation price level warning marker ──
// Displays a prominent warning line at the liquidation price with a 'LIQ'
// label. Colour shifts from warning to critical based on distance to market.
//
// Data shape:
//   { label?: string (default 'LIQ'),
//     distance?: number (distance from current price),
//     riskZone?: boolean }
//
// Style: solid red/orange line with warning icon.
//
// @since 3.3.8

import { createPriceLineOverlay } from '../../PriceLineOverlayBase'

export const liquidationPriceDefinition = createPriceLineOverlay({
  id: 'liquidation-price',
  name: 'Liquidation Price',
  category: 'trade',
  defaultStyle: {
    color: '#ff7043',
    lineWidth: 2,
    lineDash: [], // solid line
    labelBg: '#ff7043',
    labelText: '#ffffff',
    icon: '\u{26A0}\u{FE0F}', // ⚠️
  },
})
