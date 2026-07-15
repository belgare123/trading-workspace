/**
 * ServiceConsole — REPL для сервисов Runtime
 *
 * Выполняет вызовы к MarketApi, StrategyApi, PortfolioApi и другим.
 *
 * @since 2.0.0
 */

import { useState } from 'react'
import { runtimeEventBus } from '../../EventBus'
import { usePlayground, type ConsoleEntry } from '../PlaygroundContext'

function generateId() { return Math.random().toString(36).slice(2, 9) }

const SERVICE_COMMANDS = [
  { cmd: 'market.symbols()', desc: 'List all market symbols' },
  { cmd: 'market.price("BTCUSDT")', desc: 'Get current price of symbol' },
  { cmd: 'market.subscribe("BTCUSDT")', desc: 'Subscribe to symbol updates' },
  { cmd: 'portfolio.positions()', desc: 'List open positions' },
  { cmd: 'portfolio.balance()', desc: 'Get portfolio balance' },
  { cmd: 'strategy.list()', desc: 'List active strategies' },
  { cmd: 'plugin.list()', desc: 'List installed plugins' },
  { cmd: 'ml.models()', desc: 'List ML models' },
  { cmd: 'replay.state()', desc: 'Get replay state' },
  { cmd: 'search.index()', desc: 'Get search index stats' },
]

function evalService(cmd: string): string {
  const trimmed = cmd.trim()

  if (trimmed === 'market.symbols()') {
    return JSON.stringify(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'ADAUSDT'])
  }
  if (trimmed.startsWith('market.price(')) {
    const m = trimmed.match(/market\.price\(["'](.+?)["']\)/)
    if (m) return JSON.stringify({ symbol: m[1], price: 45230 + Math.random() * 500, timestamp: Date.now() })
    return 'Invalid syntax'
  }
  if (trimmed === 'portfolio.positions()') {
    return JSON.stringify([
      { symbol: 'BTCUSDT', side: 'long', size: 1.5, pnl: 750 },
      { symbol: 'ETHUSDT', side: 'short', size: 10, pnl: -120 },
    ])
  }
  if (trimmed === 'portfolio.balance()') {
    return JSON.stringify({ BTC: { free: 0.5, locked: 0.1 }, USDT: { free: 25000, locked: 5000 } })
  }
  if (trimmed === 'strategy.list()') {
    return JSON.stringify([{ id: 'ma-cross', name: 'MA Crossover', active: true }, { id: 'rsi-reversal', name: 'RSI Reversal', active: false }])
  }
  if (trimmed === 'plugin.list()') {
    return JSON.stringify(['hello-widget', 'hello-plugin', 'market-heatmap', 'telegram-notifier', 'risk-dashboard'])
  }
  if (trimmed === 'ml.models()') {
    return JSON.stringify([{ id: 'price-predictor', name: 'Price Predictor', version: '2.1.0', accuracy: 0.78 }])
  }
  if (trimmed === 'replay.state()') {
    return JSON.stringify({ status: 'idle', session: null, ticks: 0 })
  }
  if (trimmed === 'search.index()') {
    return JSON.stringify({ documents: 1420, plugins: 8, commands: 24 })
  }

  return `Unknown command: ${trimmed}`
}

export function ServiceConsole() {
  const { serviceCommand, setServiceCommand, serviceResult, setServiceResult, addConsoleEntry } = usePlayground()
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)

  const execute = () => {
    if (!serviceCommand.trim()) return

    const result = evalService(serviceCommand)
    setServiceResult(result)
    setHistory((prev) => [serviceCommand, ...prev].slice(0, 50))
    setHistoryIdx(-1)

    const entry: ConsoleEntry = {
      id: generateId(),
      timestamp: Date.now(),
      level: 'info',
      message: `$ ${serviceCommand}`,
      data: result,
    }
    addConsoleEntry(entry)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      execute()
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0) {
        const idx = Math.min(historyIdx + 1, history.length - 1)
        setHistoryIdx(idx)
        setServiceCommand(history[idx])
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIdx > 0) {
        const idx = historyIdx - 1
        setHistoryIdx(idx)
        setServiceCommand(history[idx])
      } else {
        setHistoryIdx(-1)
        setServiceCommand('')
      }
    }
  }

  return (
    <div className="playground-panel">
      <h3 className="panel-title">⚡ Service Console</h3>
      <p className="panel-desc">REPL for Runtime services — type a command and press Enter</p>

      {/* REPL input */}
      <div className="repl-input-group">
        <span className="repl-prompt">$</span>
        <input
          className="repl-input"
          value={serviceCommand}
          onChange={(e) => setServiceCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command (e.g. market.symbols())"
          spellCheck={false}
          autoComplete="off"
        />
        <button className="btn btn-small btn-primary" onClick={execute}>Run</button>
      </div>

      {/* Result */}
      {serviceResult && (
        <div className="repl-result">
          <pre className="repl-output">{serviceResult}</pre>
        </div>
      )}

      {/* Quick commands */}
      <div className="quick-commands">
        <h4 className="section-subtitle">Quick Commands</h4>
        <div className="command-chips">
          {SERVICE_COMMANDS.map((sc) => (
            <button
              key={sc.cmd}
              className="command-chip"
              onClick={() => { setServiceCommand(sc.cmd); setServiceResult('') }}
              title={sc.desc}
            >
              {sc.cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
