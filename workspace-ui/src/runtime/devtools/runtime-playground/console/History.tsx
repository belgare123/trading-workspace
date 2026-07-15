/**
 * History — управление историей команд Playground
 *
 * @since 2.0.0
 */

import { usePlayground } from '../PlaygroundContext'

export function History() {
  const { consoleEntries, clearConsole } = usePlayground()

  return (
    <div className="console-history">
      <div className="history-header">
        <strong>Command History</strong>
        <span className="history-count">{consoleEntries.length} entries</span>
      </div>
      <div className="history-list">
        {consoleEntries.slice(0, 20).map((entry) => (
          <div key={entry.id} className="history-item">
            <span className="history-time">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
            <span className="history-msg">{entry.message}</span>
          </div>
        ))}
        {consoleEntries.length === 0 && (
          <div className="history-empty">No history yet</div>
        )}
      </div>
    </div>
  )
}
