/**
 * BenchmarkStudio — main layout for the Benchmark Suite UI
 *
 * Shows scenario list, live charts, results table, and compare view.
 *
 * @since 2.0.0
 */

import { useState, useEffect, useCallback } from 'react'
import { BenchmarkRunner } from '../BenchmarkRunner'
import { BenchmarkRegistry } from '../BenchmarkRegistry'
import { ScenarioList } from './ScenarioList'
import { LiveCharts } from './LiveCharts'
import { ResultsTable } from './ResultsTable'
import { CompareView } from './CompareView'
import type { BenchmarkReport, BenchmarkCategory } from '../types'

type ViewMode = 'scenarios' | 'running' | 'results' | 'compare'

export function BenchmarkStudio() {
  const [activeView, setActiveView] = useState<ViewMode>('scenarios')
  const [report, setReport] = useState<BenchmarkReport | null>(null)
  const [scenarioStatus, setScenarioStatus] = useState<Record<string, 'idle' | 'warmup' | 'running' | 'completed' | 'error'>>({})
  const [runner] = useState(() => new BenchmarkRunner())

  // Initialize scenario statuses
  useEffect(() => {
    const statuses: Record<string, 'idle' | 'warmup' | 'running' | 'completed' | 'error'> = {}
    for (const scenario of BenchmarkRegistry.list()) {
      statuses[scenario.id] = 'idle'
    }
    setScenarioStatus(statuses)
  }, [])

  const handleRunAll = useCallback(async () => {
    setActiveView('running')
    setReport(null)

    runner.onProgress((scenarioId, status) => {
      setScenarioStatus((prev) => ({ ...prev, [scenarioId]: status }))
    })

    const result = await runner.runAll()
    setReport(result)
    setActiveView('results')
  }, [runner])

  const handleRunCategory = useCallback(async (category: BenchmarkCategory) => {
    setActiveView('running')
    setReport(null)

    runner.onProgress((scenarioId, status) => {
      setScenarioStatus((prev) => ({ ...prev, [scenarioId]: status }))
    })

    const result = await runner.runCategory(category)
    setReport(result)
    setActiveView('results')
  }, [runner])

  const totalScenarios = BenchmarkRegistry.list().length
  const completedScenarios = Object.values(scenarioStatus).filter((s) => s === 'completed' || s === 'error').length

  return (
    <div className="benchmark-studio">
      <div className="studio-header">
        <h2 className="studio-title">Benchmark Studio</h2>
        <div className="studio-actions">
          <button className="btn btn-primary" onClick={handleRunAll} disabled={runner.isRunning}>
            {runner.isRunning ? 'Running...' : 'Run All'}
          </button>
        </div>
      </div>

      {/* View switcher */}
      <div className="benchmark-tabs">
        <button className={`benchmark-tab ${activeView === 'scenarios' ? 'active' : ''}`} onClick={() => setActiveView('scenarios')}>
          Scenarios ({totalScenarios})
        </button>
        <button className={`benchmark-tab ${activeView === 'running' ? 'active' : ''}`} onClick={() => setActiveView('running')} disabled={!runner.isRunning}>
          Running {runner.isRunning ? `(${completedScenarios}/${totalScenarios})` : ''}
        </button>
        <button className={`benchmark-tab ${activeView === 'results' ? 'active' : ''}`} onClick={() => setActiveView('results')} disabled={!report}>
          Results
        </button>
        <button className={`benchmark-tab ${activeView === 'compare' ? 'active' : ''}`} onClick={() => setActiveView('compare')} disabled={!report}>
          Compare
        </button>
      </div>

      <div className="studio-content">
        {activeView === 'scenarios' && (
          <ScenarioList
            statuses={scenarioStatus}
            onRunCategory={handleRunCategory}
            onRunScenario={async (id) => {
              setActiveView('running')
              runner.onProgress((sid, status) => {
                setScenarioStatus((prev) => ({ ...prev, [sid]: status }))
              })
              await runner.runSingle(id)
              const r = runner.generateReport()
              setReport(r)
              setActiveView('results')
            }}
          />
        )}

        {activeView === 'running' && (
          <div className="running-view">
            <LiveCharts statuses={scenarioStatus} report={report} />
          </div>
        )}

        {activeView === 'results' && report && <ResultsTable report={report} />}

        {activeView === 'compare' && report && <CompareView report={report} />}
      </div>
    </div>
  )
}
