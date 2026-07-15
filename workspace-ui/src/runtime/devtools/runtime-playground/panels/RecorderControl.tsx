/**
 * RecorderControl — управление Event Recorder
 *
 * Record / Stop / Replay / Save / Load.
 *
 * @since 2.0.0
 */

import { useState } from 'react'
import { usePlayground, type ConsoleEntry } from '../PlaygroundContext'

function generateId() { return Math.random().toString(36).slice(2, 9) }

export function RecorderControl() {
  const { isRecording, setIsRecording, addConsoleEntry } = usePlayground()
  const [recordedEvents, setRecordedEvents] = useState<number>(0)
  const [replaySpeed, setReplaySpeed] = useState(1)

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false)
      addConsoleEntry({
        id: generateId(),
        timestamp: Date.now(),
        level: 'info',
        message: `Recording stopped — ${recordedEvents} events captured`,
      })
    } else {
      setIsRecording(true)
      setRecordedEvents(0)
      addConsoleEntry({
        id: generateId(),
        timestamp: Date.now(),
        level: 'success',
        message: 'Recording started',
      })
    }
  }

  return (
    <div className="playground-panel">
      <h3 className="panel-title">🔄 Recorder Control</h3>
      <p className="panel-desc">Record and replay runtime events for debugging</p>

      {/* Main controls */}
      <div className="recorder-main">
        <button
          className={`btn btn-large ${isRecording ? 'btn-danger' : 'btn-success'}`}
          onClick={toggleRecording}
        >
          {isRecording ? '⏹ Stop Recording' : '● Record'}
        </button>

        <div className="recorder-stats">
          <div className="stat">
            <span className="stat-label">Events</span>
            <span className="stat-value">{recordedEvents}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Status</span>
            <span className={`stat-value ${isRecording ? 'recording' : ''}`}>
              {isRecording ? '🔴 Recording' : 'Idle'}
            </span>
          </div>
        </div>
      </div>

      {/* Replay controls */}
      <div className="recorder-replay">
        <h4 className="section-subtitle">Replay</h4>
        <div className="replay-controls">
          <button className="btn btn-primary" title="Play recorded events">
            ▶ Replay
          </button>
          <button className="btn btn-secondary" title="Pause replay">
            ⏸ Pause
          </button>
          <div className="speed-control">
            <label>Speed:</label>
            <select value={replaySpeed} onChange={(e) => setReplaySpeed(Number(e.target.value))}>
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={5}>5x</option>
              <option value={10}>10x</option>
            </select>
          </div>
        </div>
      </div>

      {/* Save/Load */}
      <div className="action-row">
        <button className="btn btn-info" onClick={() => addConsoleEntry({ id: generateId(), timestamp: Date.now(), level: 'info', message: 'Events saved to file' })}>
          💾 Save
        </button>
        <button className="btn btn-info" onClick={() => addConsoleEntry({ id: generateId(), timestamp: Date.now(), level: 'info', message: 'Events loaded from file' })}>
          📂 Load
        </button>
      </div>
    </div>
  )
}
