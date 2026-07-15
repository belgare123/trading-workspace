/**
 * PluginSandbox — управление lifecycle загруженных плагинов
 *
 * Load / Unload / Restart / Reload / Sleep / Kill.
 *
 * @since 2.0.0
 */

import { useState } from 'react'
import { usePlayground, type ConsoleEntry } from '../PlaygroundContext'

function generateId() { return Math.random().toString(36).slice(2, 9) }

const AVAILABLE_PLUGINS = [
  { id: 'hello-widget', manifest: '1.0.0', status: 'loaded' },
  { id: 'hello-plugin', manifest: '1.0.0', status: 'loaded' },
  { id: 'market-heatmap', manifest: '1.0.0', status: 'loaded' },
  { id: 'telegram-notifier', manifest: '1.0.0', status: 'unloaded' },
  { id: 'orderbook-depth', manifest: '1.0.0', status: 'unloaded' },
  { id: 'risk-dashboard', manifest: '1.0.0', status: 'unloaded' },
  { id: 'ml-predictor', manifest: '1.0.0', status: 'unloaded' },
]

type PluginStatus = 'loaded' | 'unloaded' | 'loading' | 'unloading' | 'error'

export function PluginSandbox() {
  const { addConsoleEntry, setActivePanel } = usePlayground()
  const [plugins, setPlugins] = useState(AVAILABLE_PLUGINS)
  const [selectedPlugin, setSelectedPlugin] = useState<string>('market-heatmap')
  const [actionLog, setActionLog] = useState<string[]>([])

  const log = (msg: string) => {
    setActionLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50))
    addConsoleEntry({ id: generateId(), timestamp: Date.now(), level: 'info', message: msg })
  }

  const load = (id: string) => {
    log(`Loading plugin: ${id}...`)
    setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'loading' as PluginStatus } : p)))
    setTimeout(() => {
      setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'loaded' as PluginStatus } : p)))
      log(`✅ Plugin loaded: ${id}`)
    }, 600)
  }

  const unload = (id: string) => {
    log(`Unloading plugin: ${id}...`)
    setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'unloading' as PluginStatus } : p)))
    setTimeout(() => {
      setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'unloaded' as PluginStatus } : p)))
      log(`Plugin unloaded: ${id}`)
    }, 400)
  }

  const restart = (id: string) => {
    unload(id)
    setTimeout(() => load(id), 800)
    log(`Restarting: ${id}`)
  }

  const reload = (id: string) => {
    log(`Hot-reload plugin: ${id}...`)
    setTimeout(() => log(`✅ Plugin reloaded: ${id}`), 500)
  }

  const sleep = (id: string) => {
    log(`💤 Plugin sleeping: ${id}`)
  }

  const kill = (id: string) => {
    log(`🔥 Killing plugin: ${id}`)
    setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'unloaded' as PluginStatus } : p)))
  }

  const selected = plugins.find((p) => p.id === selectedPlugin)
  const isLoaded = selected?.status === 'loaded'

  return (
    <div className="playground-panel">
      <h3 className="panel-title">🧩 Plugin Sandbox</h3>
      <p className="panel-desc">Manage plugin lifecycle — Load, Unload, Restart, Reload, Sleep, Kill</p>

      {/* Plugin selector */}
      <div className="field-group">
        <label className="field-label">Plugin</label>
        <div className="plugin-grid">
          {plugins.map((p) => (
            <div
              key={p.id}
              className={`plugin-chip ${selectedPlugin === p.id ? 'selected' : ''} status-${p.status}`}
              onClick={() => setSelectedPlugin(p.id)}
            >
              <span className="plugin-chip-name">{p.id}</span>
              <span className={`plugin-chip-status status-${p.status}`}>{p.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      {selected && (
        <div className="plugin-controls">
          <div className="plugin-info">
            <strong>{selected.id}</strong> v{selected.manifest} — {selected.status}
          </div>
          <div className="btn-group">
            <button
              className="btn btn-success"
              disabled={isLoaded}
              onClick={() => load(selected.id)}
            >
              Load
            </button>
            <button
              className="btn btn-warning"
              disabled={!isLoaded}
              onClick={() => unload(selected.id)}
            >
              Unload
            </button>
            <button
              className="btn btn-info"
              disabled={!isLoaded}
              onClick={() => restart(selected.id)}
            >
              Restart
            </button>
            <button
              className="btn btn-info"
              disabled={!isLoaded}
              onClick={() => reload(selected.id)}
            >
              Reload
            </button>
            <button
              className="btn btn-secondary"
              disabled={!isLoaded}
              onClick={() => sleep(selected.id)}
            >
              Sleep
            </button>
            <button
              className="btn btn-danger"
              onClick={() => kill(selected.id)}
            >
              Kill
            </button>
          </div>
        </div>
      )}

      {/* Log */}
      <div className="action-log">
        <h4 className="section-subtitle">Activity Log</h4>
        <div className="log-list">
          {actionLog.map((msg, i) => (
            <div key={i} className="log-line">{msg}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
