/**
 * LiveCharts — real-time progress and status during benchmark runs
 *
 * @since 2.0.0
 */

import { BenchmarkRegistry } from '../BenchmarkRegistry'
import type { BenchmarkReport } from '../types'

interface Props {
  statuses: Record<string, 'idle' | 'warmup' | 'running' | 'completed' | 'error'>
  report: BenchmarkReport | null
}

export function LiveCharts({ statuses, report }: Props) {
  const allScenarios = BenchmarkRegistry.list()
  const total = allScenarios.length
  const completed = Object.values(statuses).filter((s) => s === 'completed' || s === 'error').length
  const running = Object.values(statuses).filter((s) => s === 'running' || s === 'warmup').length
  const progress = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className="live-charts">
      <div className="progress-section">
        <h3>Benchmark Progress</h3>
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
          <span className="progress-label">{progress.toFixed(0)}%</span>
        </div>
        <div className="progress-stats">
          <span className="stat-completed">✅ {completed} completed</span>
          <span className="stat-running">⏳ {running} running</span>
          <span className="stat-total">📋 {total} total</span>
        </div>
      </div>

      <div className="scenario-progress-list">
        {allScenarios.map((s) => {
          const status = statuses[s.id] ?? 'idle'
          return (
            <div key={s.id} className={`scenario-progress-item ${status}`}>
              <span className="sp-icon">
                {status === 'completed' && '✅'}
                {status === 'error' && '❌'}
                {status === 'running' && '⏳'}
                {status === 'warmup' && '🔥'}
                {status === 'idle' && '⏸️'}
              </span>
              <span className="sp-name">{s.name}</span>
              <span className="sp-status">{status}</span>
            </div>
          )
        })}
      </div>

      {report && (
        <div className="live-score">
          <h3>Runtime Score</h3>
          <div className="score-display">
            <span className="score-value">{report.overallScore.toFixed(1)}</span>
            <span className="score-grade">{report.grade}</span>
          </div>
        </div>
      )}
    </div>
  )
}
