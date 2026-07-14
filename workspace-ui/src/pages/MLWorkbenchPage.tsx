import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listModels,
  getModel,
  startTraining,
  getTrainingRun,
  evaluateModel,
  promoteModel,
  listExperiments,
} from '../api/ml'
import type {
  ModelSummary,
  ModelDetail,
  TrainingRun,
  Experiment,
  EvaluateResult,
  ModelStatus,
  ConfusionMatrix,
  FeatureImportance,
} from '../types'

/* ── Constants ── */

const STATUS_COLORS: Record<ModelStatus, string> = {
  draft: 'bg-surface-400 text-surface-600',
  training: 'bg-accent-cyan/20 text-accent-cyan',
  ready: 'bg-accent-green/20 text-accent-green',
  production: 'bg-primary-500/20 text-primary-400',
  failed: 'bg-accent-red/20 text-accent-red',
  archived: 'bg-surface-400 text-surface-600',
}

const STATUS_LABELS: Record<ModelStatus, string> = {
  draft: 'Draft',
  training: 'Training',
  ready: 'Ready',
  production: 'Production',
  failed: 'Failed',
  archived: 'Archived',
}

const STATUS_ORDER: ModelStatus[] = ['draft', 'training', 'ready', 'production', 'archived']

const TAB_IDS = ['models', 'training', 'experiments', 'evaluation', 'promotion'] as const
type TabId = (typeof TAB_IDS)[number]

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'models', label: 'Models', icon: '🧠' },
  { id: 'training', label: 'Training', icon: '⚡' },
  { id: 'experiments', label: 'Experiments', icon: '🔬' },
  { id: 'evaluation', label: 'Evaluation', icon: '📊' },
  { id: 'promotion', label: 'Promotion', icon: '🚀' },
]

/* ── Helpers ── */

function fmtTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

function fmtNum(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

function MetricCard({ label, value, suffix = '', color = 'text-primary-400' }: { label: string; value: string | number; suffix?: string; color?: string }) {
  return (
    <div className="bg-surface-100 border border-border rounded-lg p-3 text-center">
      <div className="text-xs text-surface-600 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}{suffix}</div>
    </div>
  )
}

/* ── Live Loss/Accuracy Chart (SVG) ── */
function MiniChart({ data, color, height = 60 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null
  const width = 200
  const min = Math.min(...data) * 0.95
  const max = Math.max(...data) * 1.05
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 8) - 4
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── Confusion Matrix ── */
function ConfusionMatrixGrid({ data }: { data: ConfusionMatrix }) {
  const { labels, matrix } = data
  if (!labels?.length || !matrix?.length) return <div className="text-surface-600 text-xs">No data</div>
  const maxVal = Math.max(...matrix.flat())
  return (
    <div className="inline-block">
      <div className="grid gap-px" style={{ gridTemplateColumns: `auto repeat(${labels.length}, 64px)` }}>
        <div />
        {labels.map((l) => <div key={l} className="text-xs text-surface-600 text-center px-2 py-1">{l}</div>)}
        {matrix.map((row, i) => (
          <>
            <div className="text-xs text-surface-600 text-right pr-2 py-1">{labels[i]}</div>
            {row.map((cell, j) => {
              const intensity = maxVal > 0 ? cell / maxVal : 0
              const isDiagonal = i === j
              return (
                <div
                  key={`${i}-${j}`}
                  className="text-center py-2 px-2 text-xs font-mono rounded"
                  style={{
                    backgroundColor: isDiagonal
                      ? `rgba(64, 192, 87, ${0.15 + intensity * 0.5})`
                      : `rgba(250, 82, 82, ${intensity * 0.3})`,
                    color: intensity > 0.5 ? '#c1c2c5' : '#5c5f66',
                  }}
                >
                  {cell}
                </div>
              )
            })}
          </>
        ))}
      </div>
      <div className="flex gap-4 mt-2 text-xs text-surface-600">
        <span><span className="inline-block w-3 h-3 rounded bg-accent-green/40 mr-1 align-middle" /> Correct</span>
        <span><span className="inline-block w-3 h-3 rounded bg-accent-red/20 mr-1 align-middle" /> Wrong</span>
      </div>
    </div>
  )
}

/* ── Feature Importance Bar ── */
function FeatureImportanceBars({ data }: { data: FeatureImportance[] }) {
  if (!data?.length) return <div className="text-surface-600 text-xs">No data</div>
  const maxImp = Math.max(...data.map((f) => f.importance))
  return (
    <div className="space-y-2">
      {data.map((fi) => (
        <div key={fi.name} className="flex items-center gap-2">
          <span className="text-xs text-surface-600 w-36 shrink-0 truncate" title={fi.name}>{fi.name}</span>
          <div className="flex-1 bg-surface-300 rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all"
              style={{ width: `${(fi.importance / maxImp) * 100}%` }}
            />
          </div>
          <span className="text-xs text-surface-600 w-12 text-right font-mono">{(fi.importance * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

/* ── Promotion Pipeline ── */
function PromotionPipeline({ status, onPromote }: { status: ModelStatus; onPromote: () => void }) {
  const currentIdx = STATUS_ORDER.indexOf(status)
  return (
    <div className="flex items-center gap-2">
      {STATUS_ORDER.map((s, i) => {
        const isActive = i <= currentIdx
        const isCurrent = s === status
        return (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                isCurrent ? STATUS_COLORS[s] : isActive ? 'bg-surface-300 text-surface-500' : 'bg-surface-400/40 text-surface-600'
              }`}
            >
              {STATUS_LABELS[s]}
            </div>
            {i < STATUS_ORDER.length - 1 && (
              <div className={`w-6 h-px ${i < currentIdx ? 'bg-primary-500' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
      {/* Promote button at end of pipeline */}
      {currentIdx < STATUS_ORDER.length - 1 && (
        <button onClick={onPromote} className="ml-4 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded text-xs font-medium transition-colors">
          Promote to {STATUS_LABELS[STATUS_ORDER[currentIdx + 1]]}
        </button>
      )}
    </div>
  )
}

/* ── Model Card ── */
function ModelCard({ model, onSelect, onTrain, onPromote }: {
  model: ModelSummary
  onSelect: () => void
  onTrain: () => void
  onPromote: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className="bg-surface-200 border border-border rounded-lg p-4 hover:border-surface-500 transition-colors cursor-pointer space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-surface-500 truncate">{model.name}</div>
          <div className="text-xs text-surface-600 mt-0.5 truncate">{model.model_type} · {model.framework}</div>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[model.status]}`}>
          {STATUS_LABELS[model.status]}
        </span>
      </div>

      {model.accuracy > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-surface-600">Accuracy</span>
            <span className="text-sm font-bold text-accent-green">{(model.accuracy * 100).toFixed(1)}%</span>
          </div>
          {model.last_trained && (
            <div className="flex flex-col">
              <span className="text-xs text-surface-600">Last trained</span>
              <span className="text-xs text-surface-600">{fmtTime(model.last_trained)}</span>
            </div>
          )}
        </div>
      )}

      {model.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {model.tags.slice(0, 4).map((t) => (
            <span key={t} className="px-1.5 py-0.5 bg-surface-300 rounded text-xs text-surface-600">{t}</span>
          ))}
          {model.tags.length > 4 && <span className="text-xs text-surface-600">+{model.tags.length - 4}</span>}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {model.status === 'draft' && (
          <button onClick={(e) => { e.stopPropagation(); onTrain() }} className="flex-1 px-2 py-1 bg-accent-cyan/20 text-accent-cyan rounded text-xs font-medium hover:bg-accent-cyan/30 transition-colors">
            Train
          </button>
        )}
        {(model.status === 'ready' || model.status === 'production') && (
          <button onClick={(e) => { e.stopPropagation(); onPromote() }} className="flex-1 px-2 py-1 bg-primary-500/20 text-primary-400 rounded text-xs font-medium hover:bg-primary-500/30 transition-colors">
            Promote
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Training Run Card ── */
function TrainingRunCard({ run, metricsHistory }: { run: TrainingRun; metricsHistory: number[][] }) {
  return (
    <div className="bg-surface-200 border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-surface-500">{run.model_name}</div>
          <div className="text-xs text-surface-600">Training {run.status}</div>
        </div>
        <span className="px-2 py-0.5 bg-accent-cyan/20 text-accent-cyan rounded text-xs font-semibold animate-pulse">
          Epoch {run.current_epoch} / {run.total_epochs}
        </span>
      </div>

      {/* Progress bar */}
      <div className="bg-surface-300 rounded-full h-2">
        <div className="bg-accent-cyan h-2 rounded-full transition-all" style={{ width: `${run.progress * 100}%` }} />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Loss" value={run.metrics.loss.toFixed(4)} color="text-accent-yellow" />
        <MetricCard label="Accuracy" value={(run.metrics.accuracy * 100).toFixed(1)} suffix="%" color="text-accent-green" />
        <MetricCard label="Val Loss" value={run.metrics.val_loss.toFixed(4)} color="text-accent-red" />
        <MetricCard label="Val Acc" value={(run.metrics.val_accuracy * 100).toFixed(1)} suffix="%" color="text-accent-cyan" />
      </div>

      {/* Mini charts */}
      <div className="flex gap-6">
        {metricsHistory[0]?.length > 1 && (
          <div>
            <div className="text-xs text-surface-600 mb-1">Loss</div>
            <MiniChart data={metricsHistory[0]} color="#fcc419" />
          </div>
        )}
        {metricsHistory[1]?.length > 1 && (
          <div>
            <div className="text-xs text-surface-600 mb-1">Accuracy</div>
            <MiniChart data={metricsHistory[1]} color="#40c057" />
          </div>
        )}
      </div>

      <div className="flex gap-4 text-xs text-surface-600">
        <span>Started {fmtTime(run.started_at)}</span>
        {run.eta && <span>ETA {fmtTime(run.eta)}</span>}
        <span>LR: {run.metrics.learning_rate.toExponential(1)}</span>
      </div>
    </div>
  )
}

/* ── Experiments Table ── */
function ExperimentsTable({ experiments, onCompare }: { experiments: Experiment[]; onCompare: (ids: string[]) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 2) next.add(id)
      return next
    })
  }
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-surface-600">
              <th className="text-left py-2 px-2 w-8" />
              <th className="text-left py-2 px-2 font-medium">Name</th>
              <th className="text-left py-2 px-2 font-medium">Model</th>
              <th className="text-left py-2 px-2 font-medium">Dataset</th>
              <th className="text-right py-2 px-2 font-medium">Accuracy</th>
              <th className="text-right py-2 px-2 font-medium">Duration</th>
              <th className="text-left py-2 px-2 font-medium">Status</th>
              <th className="text-left py-2 px-2 font-medium">Started</th>
              <th className="text-left py-2 px-2 font-medium">Tags</th>
            </tr>
          </thead>
          <tbody>
            {experiments.map((exp) => (
              <tr key={exp.id} className="border-b border-border hover:bg-surface-100 transition-colors">
                <td className="py-2 px-2">
                  <input
                    type="checkbox"
                    checked={selected.has(exp.id)}
                    onChange={() => toggle(exp.id)}
                    className="accent-primary-500"
                  />
                </td>
                <td className="py-2 px-2 font-medium text-surface-500">{exp.name}</td>
                <td className="py-2 px-2 text-surface-600">{exp.model_name}</td>
                <td className="py-2 px-2 text-surface-600">{exp.dataset_name}</td>
                <td className="py-2 px-2 text-right font-mono text-surface-500">
                  {exp.accuracy > 0 ? `${(exp.accuracy * 100).toFixed(1)}%` : '—'}
                </td>
                <td className="py-2 px-2 text-right font-mono text-surface-600">
                  {fmtDuration(exp.duration_seconds)}
                </td>
                <td className="py-2 px-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    exp.status === 'completed' ? 'bg-accent-green/20 text-accent-green' :
                    exp.status === 'running' ? 'bg-accent-cyan/20 text-accent-cyan animate-pulse' :
                    exp.status === 'failed' ? 'bg-accent-red/20 text-accent-red' :
                    'bg-surface-400 text-surface-600'
                  }`}>
                    {exp.status}
                  </span>
                </td>
                <td className="py-2 px-2 text-surface-600">{fmtTime(exp.started_at)}</td>
                <td className="py-2 px-2">
                  <div className="flex gap-1">
                    {exp.tags.map((t) => (
                      <span key={t} className="px-1 bg-surface-300 rounded text-xs text-surface-600">{t}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected.size === 2 && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => onCompare(Array.from(selected))}
            className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded text-xs font-medium transition-colors"
          >
            Compare Selected
          </button>
          <span className="text-xs text-surface-600">Select up to 2 experiments to compare</span>
        </div>
      )}
    </div>
  )
}

/* ── Evaluation View ── */
function EvaluationView({ result, model }: { result: EvaluateResult; model: ModelDetail | null }) {
  if (!result) return null
  const m = result.metrics
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-3">
        <MetricCard label="Accuracy" value={(m.accuracy * 100).toFixed(1)} suffix="%" color="text-accent-green" />
        <MetricCard label="Precision" value={(m.precision * 100).toFixed(1)} suffix="%" color="text-primary-400" />
        <MetricCard label="Recall" value={(m.recall * 100).toFixed(1)} suffix="%" color="text-accent-cyan" />
        <MetricCard label="F1 Score" value={(m.f1_score * 100).toFixed(1)} suffix="%" color="text-accent-yellow" />
        <MetricCard label="ROC AUC" value={(m.roc_auc * 100).toFixed(1)} suffix="%" color="text-accent-green" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="text-xs font-semibold text-surface-500 mb-3">Confusion Matrix</h4>
          <ConfusionMatrixGrid data={result.confusion_matrix} />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-surface-500 mb-3">Feature Importance</h4>
          <FeatureImportanceBars data={result.feature_importance} />
        </div>
      </div>

      {model && model.hyperparams && (
        <div>
          <h4 className="text-xs font-semibold text-surface-500 mb-2">Hyperparameters</h4>
          <div className="bg-surface-100 border border-border rounded-lg p-3">
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div><span className="text-surface-600">LR</span><br /><span className="font-mono text-surface-500">{model.hyperparams.learning_rate}</span></div>
              <div><span className="text-surface-600">Batch</span><br /><span className="font-mono text-surface-500">{model.hyperparams.batch_size}</span></div>
              <div><span className="text-surface-600">Epochs</span><br /><span className="font-mono text-surface-500">{model.hyperparams.epochs}</span></div>
              <div><span className="text-surface-600">Optimizer</span><br /><span className="text-surface-500">{model.hyperparams.optimizer}</span></div>
              <div><span className="text-surface-600">Loss fn</span><br /><span className="text-surface-500">{model.hyperparams.loss_fn}</span></div>
              <div><span className="text-surface-600">Dropout</span><br /><span className="font-mono text-surface-500">{model.hyperparams.dropout}</span></div>
              <div><span className="text-surface-600">Layers</span><br /><span className="font-mono text-surface-500">[{model.hyperparams.hidden_layers.join(', ')}]</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Promotion View ── */
function PromotionView({ models, onPromote }: { models: ModelSummary[]; onPromote: (modelId: string) => void }) {
  const pipeline = models.filter((m) => m.status !== 'failed' && m.status !== 'archived')
  return (
    <div className="space-y-4">
      {pipeline.length === 0 && <div className="text-surface-600 text-sm">No models in promotion pipeline.</div>}
      {pipeline.map((m) => (
        <div key={m.id} className="bg-surface-200 border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-surface-500">{m.name}</span>
              <span className="text-xs text-surface-600 ml-2">v{m.version}</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[m.status]}`}>
              {STATUS_LABELS[m.status]}
            </span>
          </div>

          <PromotionPipeline
            status={m.status}
            onPromote={() => onPromote(m.id)}
          />

          {m.accuracy > 0 && (
            <div className="flex gap-4 text-xs text-surface-600">
              <span>Accuracy: <strong className="text-accent-green">{(m.accuracy * 100).toFixed(1)}%</strong></span>
              {m.last_trained && <span>Trained {fmtTime(m.last_trained)}</span>}
              <span>Framework: {m.framework}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Model Detail Panel ── */
function ModelDetailPanel({ model, onClose, onTrain, onEvaluate, onPromote }: {
  model: ModelDetail
  onClose: () => void
  onTrain: () => void
  onEvaluate: () => void
  onPromote: () => void
}) {
  return (
    <div className="bg-surface-200 border-l border-border w-96 shrink-0 overflow-y-auto p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-surface-500">{model.name}</div>
          <div className="text-xs text-surface-600">v{model.version} · {model.model_type} · {model.framework}</div>
        </div>
        <button onClick={onClose} className="text-surface-600 hover:text-surface-500 text-lg leading-none">&times;</button>
      </div>

      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[model.status]}`}>
        {STATUS_LABELS[model.status]}
      </span>

      <p className="text-xs text-surface-700 leading-relaxed">{model.description}</p>

      {model.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {model.tags.map((t) => <span key={t} className="px-1.5 py-0.5 bg-surface-300 rounded text-xs text-surface-600">{t}</span>)}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {model.status === 'draft' && (
          <button onClick={onTrain} className="px-3 py-1.5 bg-accent-cyan/20 text-accent-cyan rounded text-xs font-medium hover:bg-accent-cyan/30 transition-colors">
            Start Training
          </button>
        )}
        {(model.status === 'ready' || model.status === 'production') && (
          <>
            <button onClick={onPromote} className="px-3 py-1.5 bg-primary-500/20 text-primary-400 rounded text-xs font-medium hover:bg-primary-500/30 transition-colors">
              Promote
            </button>
            <button onClick={onEvaluate} className="px-3 py-1.5 bg-accent-green/20 text-accent-green rounded text-xs font-medium hover:bg-accent-green/30 transition-colors">
              Evaluate
            </button>
          </>
        )}
      </div>

      {/* Metrics */}
      {model.metrics && model.metrics.accuracy > 0 && (
        <>
          <div>
            <h4 className="text-xs font-semibold text-surface-500 mb-2">Classification Metrics</h4>
            <div className="grid grid-cols-2 gap-2">
              <MetricCard label="Accuracy" value={(model.metrics.accuracy * 100).toFixed(1)} suffix="%" color="text-accent-green" />
              <MetricCard label="Precision" value={(model.metrics.precision * 100).toFixed(1)} suffix="%" color="text-primary-400" />
              <MetricCard label="Recall" value={(model.metrics.recall * 100).toFixed(1)} suffix="%" color="text-accent-cyan" />
              <MetricCard label="F1" value={(model.metrics.f1_score * 100).toFixed(1)} suffix="%" color="text-accent-yellow" />
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-surface-500 mb-2">Confusion Matrix</h4>
            <ConfusionMatrixGrid data={model.confusion_matrix} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-surface-500 mb-2">Feature Importance</h4>
            <FeatureImportanceBars data={model.feature_importance} />
          </div>
        </>
      )}

      {model.hyperparams && (
        <div>
          <h4 className="text-xs font-semibold text-surface-500 mb-2">Hyperparameters</h4>
          <div className="bg-surface-100 border border-border rounded p-2 text-xs space-y-1 text-surface-600">
            <div className="flex justify-between"><span>Learning rate</span><span className="font-mono">{model.hyperparams.learning_rate}</span></div>
            <div className="flex justify-between"><span>Batch size</span><span className="font-mono">{model.hyperparams.batch_size}</span></div>
            <div className="flex justify-between"><span>Epochs</span><span className="font-mono">{model.hyperparams.epochs}</span></div>
            <div className="flex justify-between"><span>Optimizer</span><span>{model.hyperparams.optimizer}</span></div>
            <div className="flex justify-between"><span>Dropout</span><span className="font-mono">{model.hyperparams.dropout}</span></div>
            <div className="flex justify-between"><span>Layers</span><span className="font-mono">[{model.hyperparams.hidden_layers.join(', ')}]</span></div>
          </div>
        </div>
      )}

      {model.dataset && (
        <div>
          <h4 className="text-xs font-semibold text-surface-500 mb-2">Dataset</h4>
          <div className="bg-surface-100 border border-border rounded p-2 text-xs space-y-1 text-surface-600">
            <div className="flex justify-between"><span>Name</span><span>{model.dataset.name}</span></div>
            <div className="flex justify-between"><span>Rows</span><span className="font-mono">{fmtNum(model.dataset.rows)}</span></div>
            <div className="flex justify-between"><span>Target</span><span>{model.dataset.target}</span></div>
            <div><span className="text-surface-600">Features:</span> <span>{model.dataset.features?.slice(0, 6).join(', ')}{model.dataset.features?.length > 6 ? '…' : ''}</span></div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Compare Modal ── */
function CompareModal({ experiments, onClose }: { experiments: Experiment[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-surface-200 border border-border rounded-xl p-6 max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-surface-500">Experiment Comparison</h3>
          <button onClick={onClose} className="text-surface-600 hover:text-surface-500 text-lg">&times;</button>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${experiments.length}, 1fr)` }}>
          {experiments.map((exp) => (
            <div key={exp.id} className="bg-surface-100 border border-border rounded-lg p-4 space-y-3">
              <div className="text-sm font-semibold text-surface-500">{exp.name}</div>
              <div className="text-xs text-surface-600">Model: {exp.model_name}</div>
              <div className="space-y-2">
                <MetricCard label="Accuracy" value={(exp.accuracy * 100).toFixed(1)} suffix="%" color="text-accent-green" />
                <MetricCard label="Duration" value={fmtDuration(exp.duration_seconds)} color="text-surface-500" />
              </div>
              <div className="space-y-1 text-xs text-surface-600">
                <div><span className="text-surface-600">LR: </span>{exp.hyperparams.learning_rate}</div>
                <div><span className="text-surface-600">Batch: </span>{exp.hyperparams.batch_size}</div>
                <div><span className="text-surface-600">Epochs: </span>{exp.hyperparams.epochs}</div>
                <div><span className="text-surface-600">Layers: </span>[{exp.hyperparams.hidden_layers.join(', ')}]</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ── */
export default function MLWorkbenchPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabId>('models')
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [metricsHistory, setMetricsHistory] = useState<number[][]>([[], []])
  const [evalResult, setEvalResult] = useState<EvaluateResult | null>(null)
  const [compareIds, setCompareIds] = useState<string[] | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Queries
  const { data: models = [] } = useQuery({
    queryKey: ['ml-models'],
    queryFn: listModels,
    refetchInterval: polling ? 3000 : 30000,
  })

  const { data: modelDetail } = useQuery({
    queryKey: ['ml-model', selectedModelId],
    queryFn: () => getModel(selectedModelId!),
    enabled: !!selectedModelId,
  })

  const { data: experiments = [] } = useQuery({
    queryKey: ['ml-experiments'],
    queryFn: listExperiments,
  })

  const { data: trainingRun } = useQuery({
    queryKey: ['ml-training'],
    queryFn: async () => {
      const training = models.find((m) => m.status === 'training')
      if (!training) return null
      return getTrainingRun(training.id)
    },
    refetchInterval: polling ? 2000 : false,
    enabled: polling,
  })

  // Track metrics history for charts
  useEffect(() => {
    if (trainingRun) {
      setMetricsHistory((prev) => {
        const loss = [...prev[0], trainingRun.metrics.loss].slice(-50)
        const acc = [...prev[1], trainingRun.metrics.accuracy].slice(-50)
        return [loss, acc]
      })
    }
  }, [trainingRun])

  // Start/stop polling based on training status
  useEffect(() => {
    const hasTraining = models.some((m) => m.status === 'training')
    if (hasTraining && !polling) {
      setPolling(true)
      setMetricsHistory([[], []])
      setActiveTab('training')
    } else if (!hasTraining && polling) {
      setPolling(false)
    }
  }, [models, polling])

  // Cleanup poll on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // Mutations
  const trainMutation = useMutation({
    mutationFn: (modelId: string) => startTraining(modelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ml-models'] })
      setPolling(true)
      setMetricsHistory([[], []])
      setActiveTab('training')
    },
  })

  const promoteMutation = useMutation({
    mutationFn: (modelId: string) => promoteModel(modelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ml-models'] })
      queryClient.invalidateQueries({ queryKey: ['ml-model'] })
    },
  })

  const evaluateMutation = useMutation({
    mutationFn: (modelId: string) => evaluateModel(modelId),
    onSuccess: (result) => {
      setEvalResult(result)
      setActiveTab('evaluation')
    },
  })

  // Handlers
  const handleTrain = (modelId: string) => trainMutation.mutate(modelId)
  const handlePromote = (modelId: string) => promoteMutation.mutate(modelId)
  const handleEvaluate = (modelId: string) => evaluateMutation.mutate(modelId)

  // Find active training model — computes whether training is active for polling

  return (
    <div className="flex h-full">
      {/* ── Sidebar ── */}
      <div className="w-48 shrink-0 bg-surface-100 border-r border-border overflow-y-auto">
        <nav className="p-2 space-y-1">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  if (tab.id !== 'evaluation') setEvalResult(null)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-surface-600 hover:bg-surface-300 hover:text-surface-500'
                }`}
              >
                <span className="text-base">{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.id === 'training' && polling && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-accent-cyan animate-pulse" />
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'models' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-surface-500">Models</h2>
              {polling && <span className="text-xs text-accent-cyan animate-pulse">⚡ Training in progress…</span>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {models.map((m) => (
                <ModelCard
                  key={m.id}
                  model={m}
                  onSelect={() => setSelectedModelId(m.id)}
                  onTrain={() => handleTrain(m.id)}
                  onPromote={() => handlePromote(m.id)}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'training' && (
          <div>
            <h2 className="text-sm font-bold text-surface-500 mb-4">Training</h2>
            {trainingRun ? (
              <TrainingRunCard run={trainingRun} metricsHistory={metricsHistory} />
            ) : (
              <div className="bg-surface-200 border border-border rounded-lg p-8 text-center text-surface-600 text-sm">
                {polling ? 'Queued…' : 'No active training runs. Select a model and click "Train" to start.'}
              </div>
            )}
          </div>
        )}

        {activeTab === 'experiments' && (
          <div>
            <h2 className="text-sm font-bold text-surface-500 mb-4">Experiments</h2>
            <ExperimentsTable
              experiments={experiments}
              onCompare={(ids) => setCompareIds(ids)}
            />
            {compareIds && (
              <CompareModal
                experiments={experiments.filter((e) => compareIds.includes(e.id))}
                onClose={() => setCompareIds(null)}
              />
            )}
          </div>
        )}

        {activeTab === 'evaluation' && (
          <div>
            <h2 className="text-sm font-bold text-surface-500 mb-4">Evaluation</h2>
            {evalResult ? (
              <EvaluationView result={evalResult} model={modelDetail ?? null} />
            ) : (
              <div className="bg-surface-200 border border-border rounded-lg p-8 text-center text-surface-600 text-sm">
                Select a trained model and click "Evaluate" to see results.
              </div>
            )}
          </div>
        )}

        {activeTab === 'promotion' && (
          <div>
            <h2 className="text-sm font-bold text-surface-500 mb-4">Promotion Pipeline</h2>
            <PromotionView models={models} onPromote={handlePromote} />
          </div>
        )}
      </div>

      {/* ── Detail Panel (right side) ── */}
      {selectedModelId && modelDetail && (
        <ModelDetailPanel
          model={modelDetail}
          onClose={() => { setSelectedModelId(null); setEvalResult(null) }}
          onTrain={() => handleTrain(selectedModelId)}
          onEvaluate={() => handleEvaluate(selectedModelId)}
          onPromote={() => handlePromote(selectedModelId)}
        />
      )}
    </div>
  )
}
