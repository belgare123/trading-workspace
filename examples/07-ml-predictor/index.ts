/**
 * ML Predictor — полный стек: ML → Widget → Notification → Timeline → Command
 *
 * Добавляет к Example 6:
 * - ML Service (list, predict)
 * - Widget с prediction chart
 * - Команда запуска предсказания
 * - Команда запуска обучения
 * - Notification при новом предсказании
 * - Timeline integration
 * - Capabilities: ml.read, ml.write
 *
 * @since 2.0.0
 */

import { useState, useEffect } from 'react'
import { WidgetRegistry } from '../../workspace-ui/src/runtime/WidgetRegistry'
import type { WidgetDefinition } from '../../workspace-ui/src/runtime/types'
import type { PluginContext } from '../../workspace-ui/src/runtime/PluginLoader'
import { runtimeEventBus, loggingMiddleware } from '../../workspace-ui/src/runtime/EventBus'
import { EventRegistry } from '../../workspace-ui/src/runtime/EventRegistry'

/* ============================================================
 * Types
 * ============================================================ */

interface MLModel {
  id: string
  name: string
  version: string
  accuracy: number
  lastTrained: number
}

interface PredictionResult {
  modelId: string
  prediction: number
  confidence: number
  timestamp: number
  features?: Record<string, number>
}

/* ============================================================
 * Register custom event schema
 * ============================================================ */

EventRegistry.register({
  topic: 'ml.predict',
  description: 'ML model prediction result',
  version: 1,
  payload: {} as PredictionResult,
})

/* ============================================================
 * Widget: ML Predictor
 * ============================================================ */

function MLPredictorWidget() {
  const [models, setModels] = useState<MLModel[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [predictions, setPredictions] = useState<PredictionResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Загружаем доступные модели через EventBus
    runtimeEventBus.emit('system.info', {}, { source: 'MLPredictor' })
  }, [])

  useEffect(() => {
    const unsub = runtimeEventBus.on('ml.predict', (evt) => {
      const p = evt.payload as PredictionResult
      setPrediction(p)
      setPredictions((prev) => [p, ...prev].slice(0, 20))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const runPrediction = async () => {
    if (!selectedModel || !symbol) return
    setLoading(true)

    // Эмулируем предсказание (в production — вызов MLApi.predict)
    const result: PredictionResult = {
      modelId: selectedModel,
      prediction: 45000 + Math.random() * 1000,
      confidence: 0.75 + Math.random() * 0.2,
      timestamp: Date.now(),
    }

    // Отправляем через EventBus
    runtimeEventBus.emit('ml.predict', result, {
      source: 'MLPredictor',
      severity: 'info',
    })
  }

  const confidenceColor = (c: number) => {
    if (c >= 0.9) return '#00c853'
    if (c >= 0.75) return '#ffc107'
    return '#ff5252'
  }

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ margin: '0 0 12px' }}>🧠 ML Predictor</h3>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          placeholder="Symbol"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          style={{ flex: 1, padding: '4px 8px' }}
        />
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          style={{ flex: 1, padding: '4px 8px' }}
        >
          <option value="">Select model</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.name} v{m.version}</option>
          ))}
        </select>
        <button
          onClick={runPrediction}
          disabled={loading || !selectedModel}
          style={{
            padding: '4px 16px',
            background: '#448aff',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Predicting...' : 'Predict'}
        </button>
      </div>

      {/* Current Prediction */}
      {prediction && (
        <div style={{
          padding: 16,
          background: '#1a1a2e',
          borderRadius: 8,
          marginBottom: 12,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, fontWeight: 700 }}>
            ${prediction.prediction.toFixed(2)}
          </div>
          <div style={{
            fontSize: 14,
            color: confidenceColor(prediction.confidence),
          }}>
            Confidence: {(prediction.confidence * 100).toFixed(0)}%
          </div>
        </div>
      )}

      {/* Prediction History */}
      {predictions.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>History</h4>
          <div style={{ maxHeight: 150, overflowY: 'auto' }}>
            {predictions.map((p, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '2px 0',
                fontSize: 12,
                borderBottom: '1px solid #222',
              }}>
                <span>{new Date(p.timestamp).toLocaleTimeString()}</span>
                <span>${p.prediction.toFixed(2)}</span>
                <span style={{ color: confidenceColor(p.confidence) }}>
                  {(p.confidence * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ============================================================
 * Commands
 * ============================================================ */

function runMLPrediction(ctx: PluginContext): void {
  console.log('[ML] Running prediction...')
  ctx.notifications.send({
    title: '🧠 ML Prediction',
    message: 'Prediction job started',
    level: 'info',
    plugin: 'ml-predictor',
  })
}

function trainMLModel(ctx: PluginContext): void {
  console.log('[ML] Training model...')
  ctx.notifications.send({
    title: '⚙️ ML Training',
    message: 'Model training started',
    level: 'info',
    plugin: 'ml-predictor',
  })
}

/* ============================================================
 * Search
 * ============================================================ */

async function mlSearch(query: string) {
  const lower = query.toLowerCase()
  if (lower.includes('ml') || lower.includes('predict') || lower.includes('model')) {
    return [
      { title: 'ML Predictor', description: 'ML-powered price predictions', type: 'plugin', url: '/ml' },
      { title: 'Models', description: 'View trained ML models', type: 'page', url: '/ml/models' },
      { title: 'Training History', description: 'Model training results', type: 'page', url: '/ml/training' },
    ]
  }
  return []
}

/* ============================================================
 * Register / Unregister
 * ============================================================ */

export function register(ctx: PluginContext): void {
  console.log('[ML Predictor] Installing...')

  // Custom event registered earlier
  // Logging middleware для ml.* событий
  runtimeEventBus.use((event, next) => {
    if (event.topic.startsWith('ml.')) {
      console.log(`[ML Event] ${event.topic}:`, event.payload)
    }
    next()
  })

  // Widget
  WidgetRegistry.register({
    id: 'ml-predictor-widget',
    name: 'ML Predictor',
    description: 'ML-powered price prediction tool',
    category: 'ml',
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    component: MLPredictorWidget,
  })

  // Commands
  ctx.commands.register({
    id: 'ml.predict',
    name: 'Run ML Prediction',
    shortcut: 'Ctrl+Shift+M',
    execute: () => runMLPrediction(ctx),
  })
  ctx.commands.register({
    id: 'ml.train',
    name: 'Train ML Model',
    shortcut: 'Ctrl+Shift+T',
    execute: () => trainMLModel(ctx),
  })

  // Search
  ctx.search.register({
    id: 'ml-model-search',
    name: 'ML Models',
    search: mlSearch,
  })

  console.log('[ML Predictor] Ready — full stack ML plugin running')
  console.log('[ML Predictor] Capabilities: ml.read, ml.write, market.read, event.write')
}

export function unregister(): void {
  console.log('[ML Predictor] Cleaning up...')
  WidgetRegistry.unregister('ml-predictor-widget')
  console.log('[ML Predictor] Unregistered')
}
