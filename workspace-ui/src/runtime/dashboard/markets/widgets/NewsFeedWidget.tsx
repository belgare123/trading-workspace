import type { FC } from 'react'
import { cn } from '../../../../lib/utils'
import { useDataProvider } from '../../runtime/useDataProvider'
import type { NewsItem } from '../types'

export const NewsFeedWidget: FC = () => {
  const news = useDataProvider<NewsItem[]>('market-news')

  if (!news) return <div className="widget-panel"><div className="widget-loading">Loading news…</div></div>

  return (
    <div className={cn('widget-panel', 'news-feed')}>
      <div className="widget-title">📰 Market News</div>
      <div style={{ fontSize: 11, maxHeight: 280, overflowY: 'auto' }}>
        {news.map((n: NewsItem) => (
          <div key={n.id} style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{n.title}</div>
            <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-muted)' }}>
              <span>{n.source}</span>
              <span>·</span>
              <span className={
                n.sentiment === 'positive' ? 'positive' : n.sentiment === 'negative' ? 'negative' : ''
              }>
                {n.sentiment === 'positive' ? '▲' : n.sentiment === 'negative' ? '▼' : '◆'} {n.sentiment}
              </span>
              <span>·</span>
              <span>{n.symbols.join(', ')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
