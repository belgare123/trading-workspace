/**
 * CompareView — side-by-side comparison of benchmark results across categories
 *
 * @since 2.0.0
 */

import type { BenchmarkReport, BenchmarkResult } from '../types'
import { calculateGrade } from '../types'

interface Props {
  report: BenchmarkReport
}

export function CompareView({ report }: Props) {
  // Group results by category
  const byCategory = new Map<string, BenchmarkResult[]>()
  for (const result of report.results) {
    const existing = byCategory.get(result.category) ?? []
    existing.push(result)
    byCategory.set(result.category, existing)
  }

  const categories = Array.from(byCategory.entries())

  return (
    <div className="compare-view">
      <h3>Comparison View</h3>
      <p className="compare-subtitle">
        Side-by-side comparison across {categories.length} categories ({report.results.length} scenarios)
      </p>

      {/* Radar-style comparison table */}
      <div className="compare-grid">
        {categories.map(([cat, results]) => {
          const avgScore = results.reduce((s, r) => s + r.score, 0) / results.length
          const avgLatency = results.reduce((s, r) => s + r.metrics.latency.p50, 0) / results.length
          const totalThroughput = results.reduce((s, r) => s + r.metrics.throughput, 0)
          const maxMemory = Math.max(...results.map((r) => r.metrics.memory.heapUsedMB))

          return (
            <div key={cat} className="compare-card">
              <div className="compare-card-header">
                <span className="compare-category">{capitalize(cat)}</span>
                <span className={`compare-grade grade-${getGradeLetter(avgScore)}`}>{calculateGrade(avgScore)}</span>
              </div>
              <div className="compare-card-body">
                <div className="compare-stat">
                  <span className="cs-label">Score</span>
                  <span className="cs-value">{avgScore.toFixed(1)}</span>
                </div>
                <div className="compare-stat">
                  <span className="cs-label">Throughput</span>
                  <span className="cs-value">{formatTotal(totalThroughput)}</span>
                </div>
                <div className="compare-stat">
                  <span className="cs-label">Avg p50</span>
                  <span className="cs-value">{avgLatency.toFixed(2)}ms</span>
                </div>
                <div className="compare-stat">
                  <span className="cs-label">Max Memory</span>
                  <span className="cs-value">{maxMemory.toFixed(1)}MB</span>
                </div>
              </div>
              <div className="compare-card-tests">
                {results.length} test{results.length !== 1 ? 's' : ''}
              </div>
            </div>
          )
        })}
      </div>

      {/* Overall score card */}
      <div className="compare-overall">
        <div className="overall-header">
          <span className="overall-label">Runtime Performance Score</span>
          <span className="overall-value">{report.overallScore.toFixed(1)}</span>
          <span className="overall-grade">{report.grade}</span>
        </div>
        <div className="overall-bar">
          <div className="overall-bar-fill" style={{ width: `${report.overallScore}%` }} />
        </div>
      </div>
    </div>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function getGradeLetter(score: number): string {
  if (score >= 95) return 'a'
  if (score >= 80) return 'b'
  if (score >= 60) return 'c'
  return 'd'
}

function formatTotal(ops: number): string {
  if (ops >= 1_000_000) return (ops / 1_000_000).toFixed(1) + 'M'
  if (ops >= 1_000) return (ops / 1_000).toFixed(1) + 'K'
  return ops.toFixed(0)
}
