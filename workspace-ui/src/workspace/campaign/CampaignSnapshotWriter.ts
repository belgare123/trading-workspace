/**
 * CampaignSnapshotWriter.ts — File I/O for campaign snapshots
 *
 * Pure I/O layer: knows nothing about trading, metrics, or business logic.
 * Writes two files in the campaign state directory:
 *
 *   state.json     — pretty-printed current snapshot (overwritten each tick)
 *   snapshots.jsonl — append-only one-line JSON log (every snapshot ever taken)
 *
 * The writer is designed to be replaceable: swap the implementation for
 * SQLite, InfluxDB, or Prometheus Remote Write without changing the Collector.
 *
 * @since 4.9
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { CampaignSnapshotData } from './CampaignMetricsTypes'

export interface CampaignSnapshotWriterConfig {
  /** Directory to write snapshots (default: os.tmpdir()/campaign-metrics) */
  stateDir?: string
  /** Max JSONL file size before rotation in bytes (default: 100 MB) */
  maxLogBytes?: number
  /** Max rotated log files to keep (default: 3) */
  maxLogFiles?: number
}

const DEFAULT_MAX_LOG_BYTES = 100 * 1024 * 1024 // 100 MB
const DEFAULT_MAX_LOG_FILES = 3

export class CampaignSnapshotWriter {
  private stateDir: string
  private maxLogBytes: number
  private maxLogFiles: number
  private jsonlPath: string

  constructor(config: CampaignSnapshotWriterConfig = {}) {
    this.stateDir = config.stateDir ?? path.join(os.tmpdir(), 'campaign-metrics')
    this.maxLogBytes = config.maxLogBytes ?? DEFAULT_MAX_LOG_BYTES
    this.maxLogFiles = config.maxLogFiles ?? DEFAULT_MAX_LOG_FILES
    this.jsonlPath = path.join(this.stateDir, 'snapshots.jsonl')

    // Ensure directory exists
    try {
      fs.mkdirSync(this.stateDir, { recursive: true })
    } catch {
      // Best-effort
    }
  }

  /**
   * The current state directory path (useful for external consumers).
   */
  get directory(): string {
    return this.stateDir
  }

  /** Ensure the state directory exists (recreate if deleted at runtime) */
  private ensureDir(): void {
    if (!fs.existsSync(this.stateDir)) {
      try {
        fs.mkdirSync(this.stateDir, { recursive: true })
      } catch {
        // Best-effort
      }
    }
  }

  /**
   * Overwrite state.json with a pretty-printed snapshot.
   * This is the "live" file consumed by the frontend or external tools.
   */
  writeState(snapshot: CampaignSnapshotData): void {
    this.ensureDir()
    const statePath = path.join(this.stateDir, 'state.json')
    const tmpPath = statePath + '.tmp'

    try {
      const json = JSON.stringify(snapshot, null, 2)
      // Atomic write: write to .tmp, then rename
      fs.writeFileSync(tmpPath, json, 'utf-8')
      fs.renameSync(tmpPath, statePath)
    } catch (err) {
      // Fallback: direct write (may produce partial file on crash, but
      // better than losing data entirely)
      try {
        fs.writeFileSync(statePath, JSON.stringify(snapshot, null, 2), 'utf-8')
      } catch {
        console.error('[CampaignSnapshotWriter] Failed to write state.json')
      }
    }
  }

  /**
   * Append a single snapshot line to the JSONL log.
   * Each line is one complete JSON object — no formatting.
   * Automatically rotates the log when it exceeds maxLogBytes.
   */
  appendSnapshot(snapshot: CampaignSnapshotData): void {
    this.ensureDir()
    try {
      // Check rotation before writing
      this.maybeRotate()

      const line = JSON.stringify(snapshot) + '\n'
      fs.appendFileSync(this.jsonlPath, line, 'utf-8')
    } catch (err) {
      console.error('[CampaignSnapshotWriter] Failed to append snapshot:', err)
    }
  }

  /**
   * Force data to disk (fsync).
   * Call this periodically to reduce data loss on crash.
   */
  flush(): void {
    try {
      if (fs.existsSync(this.jsonlPath)) {
        const fd = fs.openSync(this.jsonlPath, 'r')
        try {
          fs.fsyncSync(fd)
        } finally {
          fs.closeSync(fd)
        }
      }
    } catch {
      // Best-effort
    }
  }

  /**
   * Rotate the JSONL log file if it exceeds the size limit.
   * Old files are renamed with a .N suffix; excess files are pruned.
   */
  rotate(): void {
    try {
      // Check current size
      if (!fs.existsSync(this.jsonlPath)) return
      const stat = fs.statSync(this.jsonlPath)
      if (stat.size < this.maxLogBytes) return

      // Shift existing rotated files
      for (let i = this.maxLogFiles - 1; i >= 0; i--) {
        const oldPath = i === 0 ? this.jsonlPath : `${this.jsonlPath}.${i}`
        if (fs.existsSync(oldPath)) {
          if (i === this.maxLogFiles - 1) {
            // Remove the oldest file
            fs.unlinkSync(oldPath)
          } else {
            fs.renameSync(oldPath, `${this.jsonlPath}.${i + 1}`)
          }
        }
      }

      // Rename current file to .1
      fs.renameSync(this.jsonlPath, `${this.jsonlPath}.1`)

      console.log(`[CampaignSnapshotWriter] Rotated snapshots.jsonl (was ${Math.round(stat.size / 1024 / 1024)} MB)`)
    } catch (err) {
      console.error('[CampaignSnapshotWriter] Rotation failed:', err)
    }
  }

  /**
   * Check if rotation is needed and rotate.
   */
  private maybeRotate(): void {
    try {
      if (!fs.existsSync(this.jsonlPath)) return
      const stat = fs.statSync(this.jsonlPath)
      if (stat.size >= this.maxLogBytes) {
        this.rotate()
      }
    } catch {
      // Best-effort
    }
  }
}
