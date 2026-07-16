// ── EarningsOverlay — earnings report marker ──
// Displays a timeline marker for company earnings with EPS and beat/miss.
//
// Data shape:
//   title: string           (ticker / quarter, e.g. 'AAPL Q3')
//   subtitle?: string       (e.g. 'EPS $1.52 vs $1.35 | Beat +$0.17')
//   importance?: 'low' | 'medium' | 'high'
//
// @since 3.3.8

import { createEventOverlay } from '../../EventOverlayBase'

export const earningsDefinition = createEventOverlay({
  id: 'earnings',
  name: 'Earnings',
  category: 'event',
  defaultStyle: {
    color: '#66bb6a',
    icon: '\u{1F4C8}', // 📈
    textColor: '#ffffff',
  },
})
