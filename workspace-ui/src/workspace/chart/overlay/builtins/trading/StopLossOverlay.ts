// ── StopLossOverlay — stop-loss price level marker ──
// Displays a red dashed horizontal line at the stop-loss price with a label
// on the right edge. Supports hit-test for interactive drag.
//
// Data shape: { label?: string, triggered?: boolean }
// Style defaults: red dashed line with '🛑' icon
//
// @since 3.3.8

import { createPriceLineOverlay } from '../../PriceLineOverlayBase'

export const stopLossDefinition = createPriceLineOverlay({
  id: 'stop-loss',
  name: 'Stop Loss',
  category: 'trade',
  defaultStyle: {
    color: '#ef5350',
    lineWidth: 1.5,
    lineDash: [4, 4],
    labelBg: '#ef5350',
    labelText: '#ffffff',
    icon: '\u{1F6D1}', // 🛑
  },
})
