/**
 * PlaygroundConsole — общая консоль для вывода Playground
 *
 * @since 2.0.0
 */

import { usePlayground, type ConsoleEntry } from '../PlaygroundContext'

export function PlaygroundConsole() {
  const { consoleEntries, clearConsole, activeInspectorTab } = usePlayground()

  const getLevelColor = (level: ConsoleEntry['level']) => {
    switch (level) {
      case 'error': return '#ff1744'
      case 'warn': return '#ffc107'
      case 'success': return '#00c853'
      case 'info': return '#448aff'
      default: return '#888'
    }
  }

  return (
    <div className="playground-console">
      <div className="console-header">
        <span className="console-title">
          {activeInspectorTab === 'console' && 'Console'}
          {activeInspectorTab === 'logs' && 'Logs'}
          {activeInspectorTab === 'errors' && 'Errors'}
          {activeInspectorTab === 'latency' && 'Latency'}
          {activeInspectorTab === 'memory' && 'Memory'}
        </span>
        <button className="btn btn-tiny btn-secondary" onClick={clearConsole}>
          Clear
        </button>
      </div>
      <div className="console-entries">
        {consoleEntries.length === 0 && (
          <div className="console-empty">No output yet — try emitting an event or running a command</div>
        )}
        {consoleEntries.map((entry) => (
          <div key={entry.id} className="console-entry" style={{ borderLeftColor: getLevelColor(entry.level) }}>
            <span className="console-time">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
            <span className="console-level" style={{ color: getLevelColor(entry.level) }}>
              [{entry.level.toUpperCase()}]
            </span>
            <span className="console-message">{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
