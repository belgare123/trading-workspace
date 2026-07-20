#!/usr/bin/env node
/**
 * healthcheck.ts — Hourly health probe for Paper Campaign
 *
 * Checks:
 *   1. Daemon process liveness (via tasklist/ps)
 *   2. Reads state.json for cert, exceptions, uptime
 *   3. Reports overall status
 *
 * Exit codes:
 *   0 — healthy
 *   1 — degraded
 *   2 — critical
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

interface HealthResult {
  timestamp: string
  campaignAlive: boolean
  stateFileOk: boolean
  exceptions: number
  uptime: string
  certResult: string
  stage: string
  overall: 'healthy' | 'degraded' | 'critical' | 'unknown'
  message: string
}

function isWin(): boolean {
  return process.platform === 'win32'
}

function findPaperCampaignPids(): number[] {
  try {
    if (isWin()) {
      const out = execSync('wmic process where "commandline like \'%%paper-campaign%%\'" get processid /format:csv 2>nul', { encoding: 'utf8', timeout: 5_000 })
      return out
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('Node'))
        .map(l => {
          const parts = l.split(',')
          const pid = parts[parts.length - 1]?.trim()
          return parseInt(pid, 10)
        })
        .filter((pid): pid is number => !isNaN(pid))
    } else {
      const out = execSync('ps aux 2>/dev/null', { encoding: 'utf8', timeout: 5_000 })
      return out
        .split('\n')
        .filter(l => l.includes('paper-campaign'))
        .filter(l => l.includes('tsx') || l.includes('node'))
        .map(l => {
          const parts = l.trim().split(/\s+/)
          return parseInt(parts[1], 10)
        })
        .filter((pid): pid is number => !isNaN(pid))
    }
  } catch {
    return []
  }
}

async function main(): Promise<number> {
  const result: HealthResult = {
    timestamp: new Date().toISOString(),
    campaignAlive: false,
    stateFileOk: false,
    exceptions: 0,
    uptime: '',
    certResult: 'N/A',
    stage: 'unknown',
    overall: 'unknown',
    message: '',
  }

  // 1. Check daemon process
  const pids = findPaperCampaignPids()
  result.campaignAlive = pids.length > 0

  // 2. Read state.json from daemon
  const statePath = join(tmpdir(), 'paper-campaign', 'state.json')
  try {
    if (existsSync(statePath)) {
      const raw = readFileSync(statePath, 'utf8')
      const state = JSON.parse(raw)
      result.stateFileOk = true
      result.exceptions = state.exceptionsCount ?? 0
      result.uptime = state.uptime ?? '?'
      result.certResult = state.lastCertResult ?? 'N/A'
      result.stage = state.stage ?? 'unknown'
    } else {
      result.stateFileOk = false
    }
  } catch {
    result.stateFileOk = false
  }

  // 3. Determine overall status
  if (result.campaignAlive && result.stateFileOk && result.exceptions === 0) {
    result.overall = 'healthy'
    result.message = `Stage=${result.stage} uptime=${result.uptime} cert=${result.certResult}`
  } else if (result.campaignAlive && result.stateFileOk && result.exceptions > 0) {
    result.overall = 'degraded'
    result.message = `${result.exceptions} exception(s) recorded, stage=${result.stage}`
  } else if (result.campaignAlive && !result.stateFileOk) {
    result.overall = 'degraded'
    result.message = 'Daemon running but state.json not readable'
  } else if (!result.campaignAlive) {
    result.overall = 'critical'
    result.message = 'Paper Campaign process NOT FOUND'
  }

  // 4. Print summary
  const icons: Record<string, string> = {
    healthy: '✅',
    degraded: '⚠️',
    critical: '❌',
    unknown: '❓',
  }
  console.log(`${icons[result.overall] ?? '❓'} Paper Campaign Health: ${result.overall}`)
  console.log(`  Process: ${result.campaignAlive ? `✅ alive (${pids.length} pid(s))` : '❌ not found'}`)
  console.log(`  State: ${result.stateFileOk ? `✅ ${result.stage} ${result.uptime}` : '❌ no state.json'}`)
  console.log(`  Exceptions: ${result.exceptions}`)
  console.log(`  Cert: ${result.certResult}`)
  console.log(`  ${result.timestamp}`)

  // 5. Save health.json
  const stateDir = join(tmpdir(), 'paper-campaign')
  try { mkdirSync(stateDir, { recursive: true }) } catch { /* best-effort */ }
  try { writeFileSync(join(stateDir, 'health.json'), JSON.stringify(result, null, 2)) } catch { /* best-effort */ }

  return result.overall === 'healthy' ? 0 : result.overall === 'degraded' ? 1 : 2
}

main().then(process.exit).catch(() => process.exit(2))
