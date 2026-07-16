// ── EconomicCalendarOverlay — macro event marker ──
// Displays a timeline marker for economic events (FOMC, CPI, NFP, etc.)
// with expected/actual values and colour-coded impact level.
//
// Data shape:
//   title: string           (event name, e.g. 'FOMC Rate Decision')
//   subtitle?: string       (e.g. 'Exp: 4.50% | Act: 4.25%')
//   importance?: 'low' | 'medium' | 'high'
//
// @since 3.3.8

import { createEventOverlay } from '../../EventOverlayBase'

export const economicCalendarDefinition = createEventOverlay({
  id: 'economic-calendar',
  name: 'Economic Calendar',
  category: 'event',
  defaultStyle: {
    color: '#ab47bc',
    icon: '\u{1F4C5}', // 📅
    textColor: '#ffffff',
  },
})
