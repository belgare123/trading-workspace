/**
 * ScriptRunner — inline редактор сценариев Runtime
 *
 * Выполняет JS-скрипты внутри Playground.
 * Позволяет исследовать Runtime интерактивно.
 *
 * @since 2.0.0
 */

import { useState, useRef } from 'react'
import { runtimeEventBus } from '../../EventBus'
import { WidgetRegistry } from '../../WidgetRegistry'
import { usePlayground, type ConsoleEntry } from '../PlaygroundContext'
import { marketSnippet } from '../snippets/market'
import { replaySnippet } from '../snippets/replay'
import { pluginSnippet } from '../snippets/plugin'
import { eventsSnippet } from '../snippets/events'
import { mlSnippet } from '../snippets/ml'

function generateId() { return Math.random().toString(36).slice(2, 9) }

interface Snippet {
  id: string
  title: string
  description: string
  code: string
}

const SNIPPETS: Snippet[] = [
  { id: 'market', title: 'Emit market tick', description: 'Emit a market.tick event with fake data', code: marketSnippet },
  { id: 'replay', title: 'Replay BTC', description: 'Simulate replay of BTCUSDT data', code: replaySnippet },
  { id: 'stress', title: 'Generate 1000 events', description: 'Stress test the EventBus', code: `// Stress EventBus\nfor (let i = 0; i < 1000; i++) {\n  runtimeEventBus.emit('system.info', {\n    message: 'Stress event #' + i,\n    timestamp: Date.now(),\n  }, { source: 'StressTest' })\n}\nconsole.log('✅ 1000 events emitted')` },
  { id: 'plugin', title: 'Load plugin', description: 'Load a plugin via PluginLoader', code: pluginSnippet },
  { id: 'unload', title: 'Unload plugin', description: 'Unload a plugin by ID', code: `// Unload plugin\nconsole.log('Unloading plugin...')\nconst pluginId = 'market-heatmap'\nWidgetRegistry.unregister('market-heatmap')\nconsole.log('Plugin unloaded: ' + pluginId)` },
  { id: 'ml', title: 'Run ML prediction', description: 'Emit ML prediction event', code: mlSnippet },
  { id: 'notification', title: 'Test Notification', description: 'Send a test notification via EventBus', code: eventsSnippet },
  { id: 'benchmark', title: 'Benchmark Search', description: 'Benchmark search performance', code: `// Benchmark Search\nconst queries = ['BTC', 'ETH', 'risk', 'ML', 'market']\nfor (const q of queries) {\n  console.log('Searching for: ' + q)\n}\nconsole.log('Benchmark complete')` },
]

export function ScriptRunner() {
  const {
    currentScript, setCurrentScript,
    scriptOutput, addScriptOutput, clearScriptOutput,
    addConsoleEntry,
  } = usePlayground()
  const [activeSnippet, setActiveSnippet] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  const runScript = () => {
    if (!currentScript.trim() || executing) return
    setExecuting(true)
    clearScriptOutput()

    addConsoleEntry({
      id: generateId(),
      timestamp: Date.now(),
      level: 'info',
      message: 'Script execution started',
    })

    try {
      // Sandboxed execution via Function constructor
      const fn = new Function(
        'runtimeEventBus',
        'WidgetRegistry',
        'console',
        'Date',
        currentScript
      )

      // Capture console.log
      const logs: string[] = []
      const sandboxConsole = {
        log: (...args: unknown[]) => {
          const line = args.map((a) =>
            typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
          ).join(' ')
          logs.push(line)
          addScriptOutput(line)
        },
      }

      fn(runtimeEventBus, WidgetRegistry, sandboxConsole, Date)

      addConsoleEntry({
        id: generateId(),
        timestamp: Date.now(),
        level: 'success',
        message: `Script executed — ${logs.length} log lines`,
      })
    } catch (err: any) {
      const errorMsg = `Error: ${err.message}`
      addScriptOutput(errorMsg)
      addConsoleEntry({
        id: generateId(),
        timestamp: Date.now(),
        level: 'error',
        message: errorMsg,
      })
    } finally {
      setExecuting(false)
    }
  }

  const loadSnippet = (snippet: Snippet) => {
    setCurrentScript(snippet.code)
    setActiveSnippet(snippet.id)
    clearScriptOutput()
    if (editorRef.current) editorRef.current.focus()
  }

  const handleTabKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newValue = currentScript.substring(0, start) + '  ' + currentScript.substring(end)
      setCurrentScript(newValue)
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      }, 0)
    }
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault()
      runScript()
    }
  }

  return (
    <div className="playground-panel script-runner-panel">
      <h3 className="panel-title">📜 Script Runner</h3>
      <p className="panel-desc">Interactive Runtime scripting — Cmd+Enter to run</p>

      {/* Examples library */}
      <div className="snippet-bar">
        <span className="snippet-label">Examples:</span>
        {SNIPPETS.map((s) => (
          <button
            key={s.id}
            className={`snippet-chip ${activeSnippet === s.id ? 'active' : ''}`}
            onClick={() => loadSnippet(s)}
            title={s.description}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="script-editor-wrapper">
        <textarea
          ref={editorRef}
          className="script-editor"
          value={currentScript}
          onChange={(e) => setCurrentScript(e.target.value)}
          onKeyDown={handleTabKey}
          rows={12}
          spellCheck={false}
          placeholder="// Write Runtime script here...\n// e.g. runtimeEventBus.emit('system.info', { message: 'Hello' }, { source: 'Playground' })"
        />
      </div>

      {/* Controls */}
      <div className="action-row">
        <button
          className="btn btn-primary"
          onClick={runScript}
          disabled={!currentScript.trim() || executing}
        >
          {executing ? '⏳ Running...' : '▶ Execute'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => { setCurrentScript(''); clearScriptOutput(); setActiveSnippet(null) }}
        >
          Clear
        </button>
        {currentScript && !activeSnippet && (
          <button
            className="btn btn-info"
            onClick={() => {
              const saved = localStorage.getItem('playground-scripts') || '[]'
              const scripts = JSON.parse(saved)
              scripts.push({ code: currentScript, saved: Date.now() })
              localStorage.setItem('playground-scripts', JSON.stringify(scripts.slice(-10)))
              addConsoleEntry({ id: generateId(), timestamp: Date.now(), level: 'success', message: 'Script saved' })
            }}
          >
            💾 Save
          </button>
        )}
      </div>

      {/* Output */}
      {scriptOutput.length > 0 && (
        <div className="script-output">
          <h4 className="section-subtitle">Output</h4>
          <pre className="output-console">
            {scriptOutput.map((line, i) => (
              <div key={i} className="output-line">{line}</div>
            ))}
          </pre>
        </div>
      )}
    </div>
  )
}
