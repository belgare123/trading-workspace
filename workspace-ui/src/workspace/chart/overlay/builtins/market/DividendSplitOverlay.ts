// ── DividendSplitOverlay — dividend / stock split marker ──
// Displays a timeline marker for dividend payments and stock splits.
//
// Data shape:
//   title: string           (e.g. 'DIV $0.25' or 'SPLIT 4:1')
//   subtitle?: string       (e.g. 'Ex-dividend date' or 'Reverse split')
//   importance?: 'low' | 'medium' | 'high'
//
// @since 3.3.8

import { createEventOverlay } from '../../EventOverlayBase'

export const dividendSplitDefinition = createEventOverlay({
  id: 'dividend-split',
  name: 'Dividend/Split',
  category: 'event',
  defaultStyle: {
    color: '#ffa726',
    icon: '\u{1F4B0}', // 💰
    textColor: '#ffffff',
  },
})
