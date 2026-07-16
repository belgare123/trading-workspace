// ── NewsEventOverlay — news headline marker on the timeline ──
// Displays a flag marker at the news timestamp with headline and importance.
//
// Data shape:
//   title: string           (headline)
//   subtitle?: string       (source / category)
//   importance?: 'low' | 'medium' | 'high'
//
// @since 3.3.8

import { createEventOverlay } from '../../EventOverlayBase'

export const newsEventDefinition = createEventOverlay({
  id: 'news-event',
  name: 'News Event',
  category: 'event',
  defaultStyle: {
    color: '#42a5f5',
    icon: '\u{1F4F0}', // 📰
    textColor: '#ffffff',
  },
})
