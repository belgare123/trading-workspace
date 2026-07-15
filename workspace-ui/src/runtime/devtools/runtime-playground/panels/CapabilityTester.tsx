/**
 * CapabilityTester — управление и тестирование capabilities плагинов
 *
 * Временное назначение/отзыв прав для отладки.
 *
 * @since 2.0.0
 */

import { useState } from 'react'
import { usePlayground, type ConsoleEntry } from '../PlaygroundContext'

function generateId() { return Math.random().toString(36).slice(2, 9) }

interface Capability {
  name: string
  granted: boolean
  description: string
}

const PLUGIN_CAPS: Record<string, Capability[]> = {
  'hello-widget': [
    { name: 'widget.write', granted: true, description: 'Register widgets' },
    { name: 'plugin.dashboard', granted: true, description: 'Access dashboard' },
  ],
  'market-heatmap': [
    { name: 'market.read', granted: true, description: 'Read market data' },
    { name: 'market.depth', granted: true, description: 'Read order book depth' },
    { name: 'widget.write', granted: true, description: 'Register widgets' },
    { name: 'event.read', granted: true, description: 'Subscribe to events' },
  ],
  'telegram-notifier': [
    { name: 'market.read', granted: true, description: 'Read market data' },
    { name: 'notification.write', granted: true, description: 'Send notifications' },
    { name: 'command.execute', granted: true, description: 'Execute commands' },
    { name: 'event.read', granted: true, description: 'Subscribe to events' },
    { name: 'admin', granted: false, description: 'Admin access' },
  ],
  'risk-dashboard': [
    { name: 'market.read', granted: true, description: 'Read market data' },
    { name: 'widget.write', granted: true, description: 'Register widgets' },
    { name: 'command.execute', granted: true, description: 'Execute commands' },
    { name: 'search.index', granted: true, description: 'Index search data' },
    { name: 'notification.write', granted: true, description: 'Send notifications' },
    { name: 'event.read', granted: true, description: 'Subscribe to events' },
    { name: 'plugin.install', granted: false, description: 'Install new plugins' },
  ],
  'ml-predictor': [
    { name: 'market.read', granted: true, description: 'Read market data' },
    { name: 'ml.read', granted: true, description: 'Read ML predictions' },
    { name: 'ml.write', granted: true, description: 'Write ML models' },
    { name: 'widget.write', granted: true, description: 'Register widgets' },
    { name: 'command.execute', granted: true, description: 'Execute commands' },
    { name: 'notification.write', granted: true, description: 'Send notifications' },
    { name: 'event.write', granted: true, description: 'Write events' },
    { name: 'search.index', granted: true, description: 'Index search data' },
    { name: 'admin', granted: false, description: 'Admin access' },
  ],
}

export function CapabilityTester() {
  const { addConsoleEntry } = usePlayground()
  const [selectedPlugin, setSelectedPlugin] = useState<string>('market-heatmap')
  const [capabilities, setCapabilities] = useState<Capability[]>(PLUGIN_CAPS['market-heatmap'])

  const selectPlugin = (id: string) => {
    setSelectedPlugin(id)
    setCapabilities(PLUGIN_CAPS[id] || [])
  }

  const toggleCap = (name: string) => {
    setCapabilities((prev) =>
      prev.map((c) => (c.name === name ? { ...c, granted: !c.granted } : c))
    )
    addConsoleEntry({
      id: generateId(),
      timestamp: Date.now(),
      level: 'info',
      message: `Capability ${name} toggled for ${selectedPlugin}`,
    })
  }

  const resetAll = () => {
    setCapabilities(PLUGIN_CAPS[selectedPlugin] || [])
    addConsoleEntry({ id: generateId(), timestamp: Date.now(), level: 'info', message: `Capabilities reset for ${selectedPlugin}` })
  }

  return (
    <div className="playground-panel">
      <h3 className="panel-title">🔐 Capability Tester</h3>
      <p className="panel-desc">Test and manipulate plugin capabilities temporarily</p>

      {/* Plugin selector */}
      <div className="field-group">
        <label className="field-label">Plugin</label>
        <div className="plugin-chips">
          {Object.keys(PLUGIN_CAPS).map((id) => (
            <div
              key={id}
              className={`plugin-chip ${selectedPlugin === id ? 'selected' : ''}`}
              onClick={() => selectPlugin(id)}
            >
              {id}
            </div>
          ))}
        </div>
      </div>

      {/* Capability list */}
      <div className="capability-list">
        {capabilities.map((cap) => (
          <div
            key={cap.name}
            className={`capability-item ${cap.granted ? 'granted' : 'denied'}`}
            onClick={() => toggleCap(cap.name)}
          >
            <span className="capability-icon">{cap.granted ? '✓' : '✗'}</span>
            <div className="capability-info">
              <span className="capability-name">{cap.name}</span>
              <span className="capability-desc">{cap.description}</span>
            </div>
            <button className="btn btn-tiny" onClick={(e) => { e.stopPropagation(); toggleCap(cap.name) }}>
              {cap.granted ? 'Revoke' : 'Grant'}
            </button>
          </div>
        ))}
      </div>

      {/* Reset */}
      <div className="action-row">
        <button className="btn btn-secondary" onClick={resetAll}>
          Reset
        </button>
      </div>
    </div>
  )
}
