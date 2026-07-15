/**
 * CommandConsole — запуск зарегистрированных команд Runtime
 *
 * @since 2.0.0
 */

import { useState } from 'react'
import { usePlayground, type ConsoleEntry } from '../PlaygroundContext'

function generateId() { return Math.random().toString(36).slice(2, 9) }

const COMMANDS = [
  { id: 'view.dashboard', name: 'View Dashboard', shortcut: 'Ctrl+1' },
  { id: 'view.market', name: 'View Market', shortcut: 'Ctrl+2' },
  { id: 'view.portfolio', name: 'View Portfolio', shortcut: 'Ctrl+3' },
  { id: 'view.strategy', name: 'View Strategy', shortcut: 'Ctrl+4' },
  { id: 'replay.play', name: 'Play Replay', shortcut: 'Ctrl+R' },
  { id: 'replay.pause', name: 'Pause Replay', shortcut: 'Ctrl+P' },
  { id: 'replay.stop', name: 'Stop Replay', shortcut: 'Ctrl+Shift+S' },
  { id: 'risk.close-all', name: 'Close All Positions', shortcut: 'Ctrl+Shift+C' },
  { id: 'risk.summary', name: 'Risk Summary', shortcut: 'Ctrl+Shift+R' },
  { id: 'ml.predict', name: 'Run ML Prediction', shortcut: 'Ctrl+Shift+M' },
  { id: 'ml.train', name: 'Train ML Model', shortcut: 'Ctrl+Shift+T' },
]

export function CommandConsole() {
  const { addConsoleEntry } = usePlayground()
  const [search, setSearch] = useState('')
  const [selectedCmd, setSelectedCmd] = useState<string | null>(null)

  const filtered = COMMANDS.filter(
    (c) =>
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
  )

  const runCommand = (cmdId: string) => {
    setSelectedCmd(cmdId)
    addConsoleEntry({
      id: generateId(),
      timestamp: Date.now(),
      level: 'success',
      message: `Executed: ${cmdId}`,
    })
  }

  return (
    <div className="playground-panel">
      <h3 className="panel-title">⌨️ Command Console</h3>
      <p className="panel-desc">Browse and execute registered Runtime commands</p>

      {/* Search */}
      <div className="field-group">
        <input
          className="field-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search commands..."
          autoFocus
        />
      </div>

      {/* Command list */}
      <div className="command-list">
        {filtered.map((cmd) => (
          <div
            key={cmd.id}
            className={`command-item ${selectedCmd === cmd.id ? 'selected' : ''}`}
            onClick={() => setSelectedCmd(cmd.id)}
          >
            <div className="command-item-header">
              <span className="command-id">{cmd.id}</span>
              <span className="command-shortcut">{cmd.shortcut}</span>
            </div>
            <div className="command-item-name">{cmd.name}</div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">No commands match "{search}"</div>
        )}
      </div>

      {/* Execute button */}
      {selectedCmd && (
        <div className="action-row">
          <button className="btn btn-primary" onClick={() => runCommand(selectedCmd)}>
            ▶ Run {selectedCmd}
          </button>
        </div>
      )}
    </div>
  )
}
