// ── FundingRateOverlay — perpetual funding rate marker ──
// Displays a timeline marker for funding rate snapshots. The rate value
// is shown as a percentage with directional colour.
//
// Data shape:
//   title: string           (e.g. 'FR 0.010%')
//   subtitle?: string       (e.g. '8h rate · Longs pay shorts')
//   importance?: 'low' | 'medium' | 'high'
//   rate?: number           (raw value for potential mini-graph in v1.x)
//
// @since 3.3.8

import { createEventOverlay } from '../../EventOverlayBase'

export const fundingRateDefinition = createEventOverlay({
  id: 'funding-rate',
  name: 'Funding Rate',
  category: 'event',
  defaultStyle: {
    color: '#26c6da',
    icon: '\u{1F4B5}', // 💵
    textColor: '#ffffff',
  },
})
