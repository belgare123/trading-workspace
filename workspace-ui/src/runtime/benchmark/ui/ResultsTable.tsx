/**
 * ResultsTable — detailed benchmark results with score breakdown
 *
 * @since 2.0.0
 */

import type { BenchmarkReport } from '../types'
import { generateJsonReport, generateMarkdownReport, generateHtmlReport } from '../ReportGenerator'

interface Props {
  report: BenchmarkReport
}

export function ResultsTable({ report }: Props) {
  const downloadReport = (format: 'json' | 'md' | 'html') => {
    let content: string
    let mime: string
    let ext: string

    switch (format) {
      case 'json':
        content = generateJsonReport(report)
        mime = 'application/json'
        ext = 'json'
        break
      case 'md':
        content = generateMarkdownReport(report)
        mime = 'text/markdown'
        ext = 'md'
        break
      case 'html':
        content = generateHtmlReport(report)
        mime = 'text/html'
        ext = 'html'
        break
    }

    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `benchmark-report.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="results-table">
      {/* Score card */}
      <div className="results-score-card">
        <div className="score-main">
          <span className="rscore-value">{report.overallScore.toFixed(1)}</span>
          <span className="rscore-grade">{report.grade}</span>
        </div>
        <div className="score-detail">
          Runtime Performance Score
          <br />
          <small>v{report.runtimeVersion} — {new Date(report.timestamp).toLocaleString()}</small>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="category-breakdown">
        <h3>Category Breakdown</h3>
        <div className="category-bars">
          {Object.entries(report.score.categories).map(([cat, info]) => (
            <div key={cat} className="category-row">
              <span className="cat-label">{capitalize(cat)}</span>
              <div className="cat-bar-bg">
                <div className="cat-bar-fill" style={{ width: `${info.score}%` }} />
                <span className="cat-bar-score">{info.score.toFixed(0)}</span>
              </div>
              <span className="cat-weight">{(info.weight * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Results table */}
      <div className="benchmark-results-table">
        <h3>Detailed Results</h3>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Scenario</th>
              <th>Throughput</th>
              <th>p50</th>
              <th>p95</th>
              <th>p99</th>
              <th>Memory</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {report.results.map((r) => (
              <tr key={r.id} className={r.success ? 'result-success' : 'result-error'}>
                <td>{r.success ? '✅' : '❌'}</td>
                <td>
                  <strong>{r.name}</strong>
                  <br />
                  <small className="text-muted">{r.category}</small>
                </td>
                <td className="mono">{formatOps(r.metrics.throughput)}</td>
                <td className="mono">{r.metrics.latency.p50.toFixed(2)}ms</td>
                <td className="mono">{r.metrics.latency.p95.toFixed(2)}ms</td>
                <td className="mono">{r.metrics.latency.p99.toFixed(2)}ms</td>
                <td className="mono">{r.metrics.memory.heapUsedMB.toFixed(1)}MB</td>
                <td className={`score-cell score-${getScoreLevel(r.score)}`}>
                  {r.score.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Download buttons */}
      <div className="report-downloads">
        <h3>Export Report</h3>
        <div className="btn-group">
          <button className="btn btn-small btn-secondary" onClick={() => downloadReport('json')}>
            📄 JSON
          </button>
          <button className="btn btn-small btn-secondary" onClick={() => downloadReport('md')}>
            📝 Markdown
          </button>
          <button className="btn btn-small btn-secondary" onClick={() => downloadReport('html')}>
            🌐 HTML
          </button>
        </div>
      </div>
    </div>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatOps(ops: number): string {
  if (ops >= 1_000_000) return (ops / 1_000_000).toFixed(1) + 'M'
  if (ops >= 1_000) return (ops / 1_000).toFixed(1) + 'K'
  return ops.toFixed(0)
}

function getScoreLevel(score: number): string {
  if (score >= 95) return 'a'
  if (score >= 80) return 'b'
  if (score >= 60) return 'c'
  return 'd'
}
