#!/usr/bin/env node
/**
 * singleton-guard.ts — Lock-file-based singleton guard
 *
 * Prevents multiple instances of the same script from running concurrently.
 * Uses a `.lock` file with PID verification so stale locks are cleaned up.
 *
 * Usage:
 * ```typescript
 * import { SingletonGuard } from './singleton-guard'
 *
 * const guard = new SingletonGuard('my-script')
 * if (!guard.acquire()) {
 *   console.error('Another instance is already running. Exiting.')
 *   process.exit(0)
 * }
 * // ... run ...
 * guard.release()
 * ```
 *
 * @since 4.9F
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface SingletonGuardConfig {
  /** Lock file name (default: script name + '.lock') */
  name?: string
  /** Custom lock directory (default: OS temp dir) */
  lockDir?: string
  /** Auto-release on process exit (default: true) */
  autoRelease?: boolean
}

export class SingletonGuard {
  private readonly lockFile: string
  private acquired = false

  constructor(config: SingletonGuardConfig = {}) {
    const name = config.name ?? 'default'
    const dir = config.lockDir ?? os.tmpdir()
    this.lockFile = path.join(dir, `${name}.lock`)
    this.acquired = false

    if (config.autoRelease !== false) {
      process.on('exit', () => this.release())
      process.on('SIGINT', () => { process.exit(0) })
      process.on('SIGTERM', () => { process.exit(0) })
    }
  }

  /**
   * Try to acquire the lock.
   * Returns true if acquired (first instance), false if another instance is running.
   */
  acquire(): boolean {
    if (this.acquired) return true

    try {
      if (fs.existsSync(this.lockFile)) {
        const content = fs.readFileSync(this.lockFile, 'utf8').trim()
        if (content) {
          const { pid, hostname, timestamp } = JSON.parse(content)
          // Check if the process is still alive
          if (this.isProcessAlive(pid, hostname)) {
            // Process is alive — another instance is running
            const age = Math.floor((Date.now() - timestamp) / 1000)
            console.error(`[SingletonGuard] Process ${pid} on ${hostname} already running (${age}s ago)`)
            return false
          }
        }
        // Stale lock — remove and re-acquire
        fs.unlinkSync(this.lockFile)
      }
    } catch {
      // If we can't read or parse, overwrite
      try { fs.unlinkSync(this.lockFile) } catch { /* ignore */ }
    }

    // Acquire
    try {
      fs.writeFileSync(
        this.lockFile,
        JSON.stringify({
          pid: process.pid,
          hostname: os.hostname(),
          timestamp: Date.now(),
          script: process.argv[1],
        }),
        'utf8',
      )
      this.acquired = true
      return true
    } catch (err) {
      console.error(`[SingletonGuard] Failed to write lock file: ${err}`)
      return false
    }
  }

  /** Release the lock. */
  release(): void {
    if (!this.acquired) return
    try {
      if (fs.existsSync(this.lockFile)) {
        fs.unlinkSync(this.lockFile)
      }
    } catch {
      // Best effort
    }
    this.acquired = false
  }

  /** Check if a process with given pid is alive (on this host). */
  private isProcessAlive(pid: number, hostname: string): boolean {
    if (hostname !== os.hostname()) return false // different host — ignore
    try {
      // Unix: kill(pid, 0) checks existence
      // Windows: process.kill(pid, 0) throws if not found
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
}
