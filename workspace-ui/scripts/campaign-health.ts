#!/usr/bin/env node
/**
 * campaign-health.ts — Campaign liveness and integrity probe
 *
 * Checks that the running paper campaign is alive, its metrics are recent,
 * and no invariants are violated. Returns exit code 0 (healthy) or 1 (degraded).
 *
 * Usage:
 *   npx tsx scripts/campaign-health.ts
 *   npx tsx scripts/campaign-health.ts --dir /tmp/paper-campaign
 *
 * @since Sprint M1.1
 */

import { existsSync, readFileSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// ── Config ──

const STALE_THRESHOLD_MS = 2 * 60 * 1000    // 2 minutes
const SNAPSHOT_SCHEMA_VERSION = 1

interface HealthReport {
  status: 'healthy' | 'degraded'
  checks: CheckResult[]
  summary: string
}

interface CheckResult {
  name: string
  passed: boolean
  detail?: string
}

// ── Helpers ──

function parseArgs(): { dir: string; verbose: boolean } {
  const args = process.argv.slice(2)
  let dir = join(tmpdir(), 'paper-campaign')
  let verbose = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && i + 1 < args.length) dir = args[++i]
    else if (args[i] === '--verbose' || args[i] === '-v') verbose = true
  }
  return { dir, verbose }
}

function ok(name: string, detail?: string): CheckResult {
  return { name, passed: true, detail }
}

function fail(name: string, detail: string): CheckResult {
  return { name, passed: false, detail }
}

function stalenessMs(filePath: string): number {
  if (!existsSync(filePath)) return Infinity
  try {
    return Date.now() - statSync(filePath).mtimeMs
  } catch {
    return Infinity
  }
}

function readCampaignPid(dir: string): number | null {
  const pidPath = join(dir, 'campaign.pid')
  try {
    const raw = readFileSync(pidPath, 'utf8').trim()
    const pid = parseInt(raw, 10)
    return isNaN(pid) ? null : pid
  } catch {
    return null
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// ── Main check ──

function runHealthCheck(): HealthReport {
  const { dir, verbose } = parseArgs()
  const checks: CheckResult[] = []
  const stateJsonPath = join(dir, 'state.json')
  const metricsDir = join(dir, 'metrics')
  const metricsStatePath = join(metricsDir, 'state.json')
  const snapshotsPath = join(metricsDir, 'snapshots.jsonl')

  // ── 1. Process liveness ──
  const pid = readCampaignPid(dir)
  if (pid !== null && isPidAlive(pid)) {
    checks.push(ok('process.alive', `PID ${pid}`))
  } else if (pid !== null) {
    checks.push(fail('process.alive', `PID ${pid} found in campaign.pid but process is dead`))
  } else {
    checks.push(fail('process.alive', 'campaign.pid not found — campaign may not be running'))
  }

  // ── 2. State file freshness ──
  const stateStaleness = stalenessMs(stateJsonPath)
  if (stateStaleness < STALE_THRESHOLD_MS) {
    checks.push(ok('state.fresh', `updated ${Math.round(stateStaleness / 1000)}s ago`))
  } else {
    checks.push(fail('state.fresh', `state.json stale: ${Math.round(stateStaleness / 1000)}s since update`))
  }

  // ── 3. State file structure ──
  try {
    const state = JSON.parse(readFileSync(stateJsonPath, 'utf8'))
    if (state.stage) checks.push(ok('state.stage', `stage=${state.stage}`))
    else checks.push(fail('state.stage', 'state.json missing stage field'))
    if (typeof state.exceptionsCount === 'number') {
      if (state.exceptionsCount === 0) checks.push(ok('state.exceptions', '0 exceptions'))
      else checks.push(fail('state.exceptions', `${state.exceptionsCount} exceptions recorded`))
    }
  } catch (err) {
    checks.push(fail('state.structure', `Cannot parse state.json: ${err}`))
  }

  // ── 4. Metrics directory ──
  if (existsSync(metricsStatePath)) {
    checks.push(ok('metrics.dir', 'metrics directory exists'))

    // ── 5. Metrics state file freshness ──
    const metricsStaleness = stalenessMs(metricsStatePath)
    if (metricsStaleness < STALE_THRESHOLD_MS) {
      checks.push(ok('metrics.fresh', `metrics updated ${Math.round(metricsStaleness / 1000)}s ago`))
    } else {
      checks.push(fail('metrics.fresh', `metrics state.json stale: ${Math.round(metricsStaleness / 1000)}s`))
    }

    // ── 6. Schema version ──
    try {
      const snap = JSON.parse(readFileSync(metricsStatePath, 'utf8'))
      if (snap.schemaVersion === SNAPSHOT_SCHEMA_VERSION) {
        checks.push(ok('metrics.schemaVersion', `v${snap.schemaVersion}`))
      } else {
        checks.push(fail('metrics.schemaVersion', `expected v${SNAPSHOT_SCHEMA_VERSION}, got v${snap.schemaVersion ?? 'undefined'}`))
      }

      // ── 7. Timestamp monotonic / freshness ──
      if (snap.timestamp) {
        const snapAge = Date.now() - snap.timestamp
        if (snapAge < STALE_THRESHOLD_MS) {
          checks.push(ok('metrics.timestamp', `${Math.round(snapAge / 1000)}s ago`))
        } else {
          checks.push(fail('metrics.timestamp', `snapshot timestamp stale: ${Math.round(snapAge / 1000)}s`))
        }
      } else {
        checks.push(fail('metrics.timestamp', 'snapshot missing timestamp'))
      }

      // ── 8. Invariants ──
      if (snap.invariants) {
        const invariants = snap.invariants as Record<string, { ok: boolean }>
        const entries = Object.entries(invariants)
        const violated = entries.filter(([, v]) => typeof v === 'object' && v && !v.ok)
        if (entries.length > 0) {
          if (violated.length === 0) {
            checks.push(ok('metrics.invariants', `all ${entries.length} passed`))
          } else {
            checks.push(fail('metrics.invariants', `${violated.length} invariant(s) violated: ${violated.map(([k]) => k).join(', ')}`))
          }
        } else {
          checks.push(ok('metrics.invariants', 'not collected yet'))
        }
      } else {
        // invariants object not present yet — not a failure if collector just started
        checks.push(ok('metrics.invariants', 'not collected yet'))
      }

      // ── 9. Health components ──
      if (snap.health) {
        const componentHealth = [
          { name: 'feed', status: snap.health.feed?.status },
          { name: 'broker', status: snap.health.broker?.status },
          { name: 'strategy', status: snap.health.strategy?.status },
        ]
        for (const comp of componentHealth) {
          if (comp.status === 'healthy' || !comp.status) {
            checks.push(ok(`health.${comp.name}`, comp.status ?? 'unknown'))
          } else {
            checks.push(fail(`health.${comp.name}`, `status=${comp.status}`))
          }
        }
      } else {
        checks.push(ok('metrics.health', 'not collected yet'))
      }

      // ── 10. Campaign context consistency ──
      if (snap.campaign?.id) {
        checks.push(ok('metrics.context', `campaign=${snap.campaign.id}`))
      }

      // ── 11. Snapshots JSONL growing ──
      if (existsSync(snapshotsPath)) {
        try {
          const lines = readFileSync(snapshotsPath, 'utf8').trim().split('\n').filter(Boolean)
          if (lines.length > 0) {
            checks.push(ok('metrics.snapshotsJsonl', `${lines.length} entries`))
            // Check last entry is recent
            try {
              const lastEntry = JSON.parse(lines[lines.length - 1])
              if (lastEntry.timestamp) {
                const lastAge = Date.now() - lastEntry.timestamp
                if (lastAge < STALE_THRESHOLD_MS) {
                  checks.push(ok('metrics.lastEntry', `${Math.round(lastAge / 1000)}s ago`))
                } else {
                  checks.push(fail('metrics.lastEntry', `last snapshot entry stale: ${Math.round(lastAge / 1000)}s`))
                }
              }
            } catch { /* skip last entry check if parse fails */ }
          } else {
            checks.push(ok('metrics.snapshotsJsonl', 'empty (just started)'))
          }
        } catch (err) {
          checks.push(fail('metrics.snapshotsJsonl', `cannot read: ${err}`))
        }
      } else {
        checks.push(ok('metrics.snapshotsJsonl', 'not yet created'))
      }
    } catch (err) {
      checks.push(fail('metrics.parse', `Cannot parse metrics state.json: ${err}`))
    }
  } else {
    checks.push(ok('metrics.dir', 'metrics not yet available (collector starting)'))
  }

  const failed = checks.filter(c => !c.passed)
  const status = failed.length === 0 ? 'healthy' : 'degraded'
  const summary = status === 'healthy'
    ? '✅ Campaign healthy'
    : `❌ Campaign degraded — ${failed.length} check(s) failed`

  return { status, checks, summary }
}

// ── Output ──

function main(): void {
  const { verbose } = parseArgs()
  const report = runHealthCheck()

  for (const check of report.checks) {
    const icon = check.passed ? '✅' : '❌'
    const detail = check.detail ? ` — ${check.detail}` : ''
    if (verbose || !check.passed) {
      console.log(`${icon} ${check.name}${detail}`)
    }
  }

  if (!verbose) {
    const failed = report.checks.filter(c => !c.passed)
    const passed = report.checks.filter(c => c.passed)
    console.log()
    console.log(`📊 ${report.status}: ${passed.length} passed, ${failed.length} failed`)
  }

  console.log()
  console.log(report.summary)
  process.exit(report.status === 'healthy' ? 0 : 1)
}

main()
