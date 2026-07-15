/**
 * ScenarioList — displays all benchmark scenarios grouped by category
 *
 * @since 2.0.0
 */

import { BenchmarkRegistry } from '../BenchmarkRegistry'
import { CATEGORY_WEIGHTS, type BenchmarkCategory } from '../types'

interface Props {
  statuses: Record<string, 'idle' | 'warmup' | 'running' | 'completed' | 'error'>
  onRunCategory: (category: BenchmarkCategory) => void
  onRunScenario: (id: string) => void
}

const STATUS_LABELS: Record<string, string> = {
  idle: 'Ready',
  warmup: 'Warming up…',
  running: 'Running…',
  completed: '✅ Done',
  error: '❌ Error',
}

const CATEGORY_LABELS: Record<BenchmarkCategory, string> = {
  eventbus: 'EventBus',
  plugin: 'Plugin',
  widget: 'Widget',
  search: 'Search',
  layout: 'Layout',
  replay: 'Replay',
  command: 'Command',
  startup: 'Startup',
}

export function ScenarioList({ statuses, onRunCategory, onRunScenario }: Props) {
  const categories = BenchmarkRegistry.categories()

  return (
    <div className="scenario-list">
      <div className="scenario-list-header">
        <h3>Benchmark Scenarios</h3>
        <p className="scenario-hint">
          {Object.keys(CATEGORY_WEIGHTS).length} categories, {BenchmarkRegistry.list().length} scenarios
        </p>
      </div>

      {categories.map((cat) => {
        const scenarios = BenchmarkRegistry.list(cat)
        const weight = CATEGORY_WEIGHTS[cat] ?? 0
        const catStatuses = scenarios.map((s) => statuses[s.id] ?? 'idle')
        const allDone = catStatuses.every((s) => s === 'completed' || s === 'error')

        return (
          <div key={cat} className={`scenario-category ${allDone ? 'all-done' : ''}`}>
            <div className="category-header">
              <div className="category-info">
                <span className="category-name">{CATEGORY_LABELS[cat]}</span>
                <span className="category-weight">Weight: {(weight * 100).toFixed(0)}%</span>
              </div>
              <button
                className="btn btn-small btn-secondary"
                onClick={() => onRunCategory(cat)}
                disabled={catStatuses.some((s) => s === 'running' || s === 'warmup')}
              >
                Run Category
              </button>
            </div>

            <div className="category-scenarios">
              {scenarios.map((scenario) => {
                const status = statuses[scenario.id] ?? 'idle'
                return (
                  <div
                    key={scenario.id}
                    className={`scenario-item ${status}`}
                    onClick={() => {
                      if (status === 'idle') onRunScenario(scenario.id)
                    }}
                  >
                    <div className="scenario-info">
                      <span className="scenario-name">{scenario.name}</span>
                      <span className="scenario-desc">{scenario.description}</span>
                    </div>
                    <div className="scenario-meta">
                      <span className="scenario-iterations">{scenario.config.iterations.toLocaleString()} iterations</span>
                      <span className={`scenario-status status-${status}`}>{STATUS_LABELS[status]}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
