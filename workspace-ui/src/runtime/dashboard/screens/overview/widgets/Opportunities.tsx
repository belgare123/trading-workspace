import type { FC } from 'react'
import { cn } from '../../../../../lib/utils'
import { useDataProvider } from '../../../runtime/useDataProvider'
import type { OpportunitiesData } from '../../../data/types'

export const Opportunities: FC = () => {
  const data = useDataProvider<OpportunitiesData>('opportunities')

  if (!data) {
    return <div className="widget-panel opportunities"><div className="widget-loading">Loading opportunities…</div></div>
  }

  return (
    <div className={cn('widget-panel opportunities')}>
      <div className="widget-title">Opportunities ({data.opportunities.length})</div>
      <div className="opp-scroll">
        {data.opportunities.slice(0, 8).map(opp => (
          <div key={opp.id} className="opp-row">
            <div className="opp-type">{iconForType(opp.type)}</div>
            <div className="opp-symbol">{opp.symbol}</div>
            <span className={cn('opp-direction', opp.direction === 'LONG' ? 'positive' : 'negative')}>{opp.direction}</span>
            <div className="opp-confidence">{opp.confidence}%</div>
            <div className="opp-profit">+{opp.potentialProfit}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function iconForType(t: string): string {
  switch (t) {
    case 'arbitrage': return '🔄'
    case 'momentum': return '⚡'
    case 'divergence': return '📐'
    case 'signal': return '📊'
    default: return '💡'
  }
}
