/**
 * EventEmitter — испускает события в EventBus для тестирования
 *
 * Chrome DevTools + Postman для Runtime.
 * Позволяет эмулировать события без реальной биржи.
 *
 * @since 2.0.0
 */

import { useState } from 'react'
import { runtimeEventBus } from '../../EventBus'
import { EventRegistry, TOPICS } from '../../EventRegistry'
import { usePlayground, type ConsoleEntry } from '../PlaygroundContext'

function generateId(): string {
  return Math.random().toString(36).slice(2, 9)
}

const TOPIC_OPTIONS = [
  { value: 'market.tick', label: 'market.tick' },
  { value: 'market.depth', label: 'market.depth' },
  { value: 'strategy.signal', label: 'strategy.signal' },
  { value: 'portfolio.position', label: 'portfolio.position' },
  { value: 'portfolio.balance', label: 'portfolio.balance' },
  { value: 'plugin.installed', label: 'plugin.installed' },
  { value: 'plugin.uninstalled', label: 'plugin.uninstalled' },
  { value: 'notification.send', label: 'notification.send' },
  { value: 'system.info', label: 'system.info' },
  { value: 'runtime.ready', label: 'runtime.ready' },
  { value: 'replay.start', label: 'replay.start' },
  { value: 'ml.predict', label: 'ml.predict' },
]

const PAYLOAD_TEMPLATES: Record<string, string> = {
  'market.tick': JSON.stringify({ symbol: 'BTCUSDT', price: 68500, volume: 1.42, change: 1.25 }, null, 2),
  'market.depth': JSON.stringify({ symbol: 'BTCUSDT', bids: [{ price: 68400, size: 1.5 }], asks: [{ price: 68600, size: 2.1 }] }, null, 2),
  'strategy.signal': JSON.stringify({ symbol: 'BTCUSDT', direction: 'buy', confidence: 0.85, reason: 'Golden cross detected' }, null, 2),
  'portfolio.position': JSON.stringify({ symbol: 'BTCUSDT', side: 'long', size: 1.5, entryPrice: 68000, currentPrice: 68500, pnl: 750, pnlPercent: 1.1 }, null, 2),
  'plugin.installed': JSON.stringify({ pluginId: 'market-heatmap', version: '1.0.0' }, null, 2),
}

export function EventEmitter() {
  const { eventTopic, setEventTopic, eventPayload, setEventPayload, addConsoleEntry, isRecording } = usePlayground()
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleTopicChange = (topic: string) => {
    setEventTopic(topic)
    const template = PAYLOAD_TEMPLATES[topic]
    if (template) setEventPayload(template)
    setValidationError(null)
  }

  const validatePayload = (): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(eventPayload)
      if (typeof parsed !== 'object' || parsed === null) {
        setValidationError('Payload must be a JSON object')
        return null
      }
      setValidationError(null)
      return parsed
    } catch (e: any) {
      setValidationError(`JSON parse error: ${e.message}`)
      return null
    }
  }

  const emitEvent = () => {
    const payload = validatePayload()
    if (!payload) return

    runtimeEventBus.emit(eventTopic as any, payload, {
      source: 'Playground:EventEmitter',
      severity: 'info',
      tags: [eventTopic],
    })

    const entry: ConsoleEntry = {
      id: generateId(),
      timestamp: Date.now(),
      level: 'success',
      message: `Emitted: ${eventTopic}`,
      data: payload,
    }
    addConsoleEntry(entry)
  }

  const getRegisteredTopics = () => {
    return EventRegistry.list()
  }

  return (
    <div className="playground-panel">
      <h3 className="panel-title">📡 Event Emitter</h3>
      <p className="panel-desc">Emit events into Runtime EventBus — test without a real exchange</p>

      {/* Topic selector */}
      <div className="field-group">
        <label className="field-label">Topic</label>
        <select
          className="field-input"
          value={eventTopic}
          onChange={(e) => handleTopicChange(e.target.value)}
        >
          {TOPIC_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Payload editor */}
      <div className="field-group">
        <label className="field-label">Payload <span className="field-hint">(JSON)</span></label>
        <textarea
          className="field-textarea"
          value={eventPayload}
          onChange={(e) => { setEventPayload(e.target.value); setValidationError(null) }}
          rows={8}
          spellCheck={false}
        />
        {validationError && <div className="field-error">{validationError}</div>}
      </div>

      {/* Emit button */}
      <div className="action-row">
        <button
          className="btn btn-primary"
          onClick={emitEvent}
          title="Emit event into EventBus"
        >
          ▶ Emit
        </button>
        {isRecording && <span className="recorder-badge">🔴 Recording active — event will be recorded</span>}
      </div>

      {/* Help */}
      <details className="help-section">
        <summary>Registered topics (EventRegistry)</summary>
        <div className="topic-list">
          {getRegisteredTopics().map((t) => (
            <div key={t.topic} className="topic-chip" onClick={() => handleTopicChange(t.topic)}>
              {t.topic}
              <span className="topic-version">v{t.version}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
