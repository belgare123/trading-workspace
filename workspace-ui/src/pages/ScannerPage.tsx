import { useState, useMemo } from 'react'
import { useStore } from '../store'
import { useScannerWs } from '../ws/useScannerWs'
import { Card, CardHeader, Badge, ScoreBadge, Input, Select } from '../components/ui'
import type { ScannerItem } from '../types'

export function ScannerPage() {
  // Connect WebSocket for live updates
  useScannerWs()

  const scannerItems = useStore((s) => s.scannerItems)
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState('all')
  const [sortBy, setSortBy] = useState<string>('score')

  const filtered = useMemo(() => {
    let items = [...scannerItems]

    // Filter
    if (search) {
      const q = search.toLowerCase()
      items = items.filter((i) => i.symbol.toLowerCase().includes(q))
    }
    if (direction !== 'all') {
      items = items.filter((i) => i.direction === direction)
    }

    // Sort
    switch (sortBy) {
      case 'score':
        items.sort((a, b) => b.score - a.score)
        break
      case 'change':
        items.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        break
      case 'volume':
        items.sort((a, b) => b.volume - a.volume)
        break
      case 'symbol':
        items.sort((a, b) => a.symbol.localeCompare(b.symbol))
        break
    }

    return items
  }, [scannerItems, search, direction, sortBy])

  return (
    <div>
      {/* Header + Filters */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-surface-50">Scanner</h1>
          <span className="text-xs text-surface-600">
            {scannerItems.length} pairs · live
            <span className="inline-block w-1.5 h-1.5 ml-1 rounded-full bg-accent-green animate-pulse" />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search symbol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-44"
          />
          <Select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'long', label: 'Long ↑' },
              { value: 'short', label: 'Short ↓' },
            ]}
          />
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            options={[
              { value: 'score', label: 'Sort: Score' },
              { value: 'change', label: 'Sort: Change' },
              { value: 'volume', label: 'Sort: Volume' },
              { value: 'symbol', label: 'Sort: Symbol' },
            ]}
          />
        </div>
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-surface-600 text-sm">
          {scannerItems.length === 0
            ? 'Connecting to scanner...'
            : 'No matching pairs'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((item) => (
            <ScannerCard key={item.symbol} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function ScannerCard({ item }: { item: ScannerItem }) {
  const isPositive = item.change >= 0

  return (
    <Card hover>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-surface-50">{item.symbol}</span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              item.direction === 'long'
                ? 'bg-accent-green/10 text-accent-green'
                : 'bg-accent-red/10 text-accent-red'
            }`}
          >
            {item.direction === 'long' ? 'LONG' : 'SHORT'}
          </span>
        </div>
        <ScoreBadge score={item.score} />
      </CardHeader>

      <div className="flex items-center justify-between text-sm">
        <span className="text-surface-50 font-mono">
          ${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className={isPositive ? 'text-accent-green' : 'text-accent-red'}>
          {isPositive ? '+' : ''}{item.changePercent}%
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-surface-600">
        <span>Vol: {item.volume.toLocaleString()}</span>
      </div>

      <div className="mt-2 flex gap-1 flex-wrap">
        {item.signals.map((s) => (
          <Badge key={s} variant={s === 'Momentum' ? 'primary' : s === 'Volume' ? 'cyan' : 'yellow'}>
            {s}
          </Badge>
        ))}
      </div>
    </Card>
  )
}
