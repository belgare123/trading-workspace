// ── TakeProfitOverlay — take-profit price level marker ──
// Displays a green dashed horizontal line at the take-profit price with a label
// on the right edge. Supports hit-test for interactive drag.
//
// Data shape: { label?: string }
// Style defaults: green dashed line with '🎯' icon
//
// @since 3.3.8

import { createPriceLineOverlay } from '../../PriceLineOverlayBase'

export const takeProfitDefinition = createPriceLineOverlay({
  id: 'take-profit',
  name: 'Take Profit',
  category: 'trade',
  defaultStyle: {
    color: '#26a69a',
    lineWidth: 1.5,
    lineDash: [4, 4],
    labelBg: '#26a69a',
    labelText: '#ffffff',
    icon: '\u{1F3AF}', // 🎯
  },
})
