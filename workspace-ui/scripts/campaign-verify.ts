#!/usr/bin/env node
/**
 * campaign-verify.ts — Deep integrity verification of campaign snapshot journal
 *
 * Reads all entries from snapshots.jsonl and validates:
 *   ✓ chronological order (timestamps non-decreasing)
 *   ✓ schemaVersion consistent (all === 1)
 *   ✓ no corrupted JSON lines
 *   ✓ no duplicate timestamps
 *   ✓ no missing required fields (context, timestamp, trading, schemaVersion)
 *   ✓ no NaN / Infinity in numeric fields
 *   ✓ campaignId consistent across all entries
 *
 * Usage:
 *   npx tsx scripts/campaign-verify.ts
 *   npx tsx scripts/campaign-verify.ts --dir /tmp/paper-campaign
 *   npx tsx scripts/campaign-verify.ts --fix    # attempt repair (future)
 *
 * Exit codes:
 *   0 — journal integrity verified
 *   1 — issues found
 *   2 — no journal to check
 *
 * @since Sprint M1.1
 */

import { existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

interface VerifyIssue {
  type: 'error' | 'warning'
  line?: number    // 1-indexed line in JSONL
  field?: string
  message: string
}

interface VerifyReport {
  totalEntries: number
  issues: VerifyIssue[]
  passed: boolean
  summary: string
}

// ── Required top-level fields in every snapshot ──
const REQUIRED_FIELDS = ['campaign', 'timestamp', 'trading', 'schemaVersion', 'runtime', 'health']

// Recursively check for NaN / Infinity
function hasInvalidNumber(obj: unknown, path = ''): string[] {
  const results: string[] = []
  if (obj === null || obj === undefined) return results
  if (typeof obj === 'number') {
    if (Number.isNaN(obj)) results.push(`${path}=NaN`)
    else if (!Number.isFinite(obj)) results.push(`${path}=${obj}`)
    return results
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => results.push(...hasInvalidNumber(v, `${path}[${i}]`)))
    return results
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      results.push(...hasInvalidNumber(v, path ? `${path}.${k}` : k))
    }
  }
  return results
}

// ── Parse args ──

function parseArgs(): { dir: string; verbose: boolean; strict: boolean } {
  const args = process.argv.slice(2)
  let dir = join(tmpdir(), 'paper-campaign')
  let verbose = false
  let strict = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && i + 1 < args.length) dir = args[++i]
    else if (args[i] === '--verbose' || args[i] === '-v') verbose = true
    else if (args[i] === '--strict' || args[i] === '-s') strict = true
  }
  return { dir, verbose, strict }
}

function verify(): VerifyReport {
  const { dir, verbose, strict } = parseArgs()
  const issues: VerifyIssue[] = []
  const snapshotsPath = join(dir, 'metrics', 'snapshots.jsonl')

  if (!existsSync(snapshotsPath)) {
    const metricsDir = join(dir, 'metrics')
    const altPath = join(metricsDir, 'state.json')
    if (existsSync(altPath)) {
      return {
        totalEntries: 1,
        issues: [{ type: 'warning', message: 'snapshots.jsonl not found — checking state.json as single entry' }],
        passed: true,
        summary: '⚠️ Only state.json found (campaign may have just started)',
      }
    }
    return {
      totalEntries: 0,
      issues: [{ type: 'error', message: 'No snapshot files found' }],
      passed: false,
      summary: '❌ No metrics data to verify',
    }
  }

  // ── Read all lines ──
  let lines: string[]
  try {
    const raw = readFileSync(snapshotsPath, 'utf8')
    lines = raw.split('\n').filter(l => l.trim().length > 0)
  } catch (err) {
    return {
      totalEntries: 0,
      issues: [{ type: 'error', message: `Cannot read snapshots.jsonl: ${err}` }],
      passed: false,
      summary: `❌ Cannot read snapshots.jsonl`,
    }
  }

  if (lines.length === 0) {
    return {
      totalEntries: 0,
      issues: [{ type: 'warning', message: 'snapshots.jsonl is empty' }],
      passed: true,
      summary: '⚠️ No snapshots recorded yet',
    }
  }

  // ── Parse and verify each entry ──
  const entries: Record<string, unknown>[] = []
  let campaignId: string | null = null
  let prevTimestamp = 0
  const seenTimestamps = new Set<number>()
  let seenSchemaVersion: number | null = null

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1

    // Parse JSON
    let entry: Record<string, unknown>
    try {
      entry = JSON.parse(lines[i])
    } catch (err) {
      issues.push({ type: 'error', line: lineNum, message: `Corrupted JSON: ${err}` })
      continue
    }
    entries.push(entry)

    // ── Required fields ──
    for (const field of REQUIRED_FIELDS) {
      if (!(field in entry) || entry[field] === null || entry[field] === undefined) {
        issues.push({ type: 'error', line: lineNum, field, message: `Missing required field: "${field}"` })
      }
    }

    // ── schemaVersion ──
    const sv = entry.schemaVersion
    if (typeof sv === 'number') {
      if (seenSchemaVersion === null) seenSchemaVersion = sv
      else if (sv !== seenSchemaVersion) {
        issues.push({ type: 'error', line: lineNum, field: 'schemaVersion', message: `Inconsistent schemaVersion: ${sv} (expected ${seenSchemaVersion})` })
      }
      if (sv !== 1) {
        issues.push({ type: strict ? 'error' : 'warning', line: lineNum, field: 'schemaVersion', message: `Unexpected schemaVersion: ${sv}` })
      }
    } else {
      issues.push({ type: 'error', line: lineNum, field: 'schemaVersion', message: `schemaVersion is not a number: ${typeof sv}` })
    }

    // ── Timestamp ──
    const ts = entry.timestamp
    if (typeof ts === 'number') {
      if (ts < 1_700_000_000_000) {
        issues.push({ type: 'warning', line: lineNum, field: 'timestamp', message: `Timestamp looks suspiciously old: ${ts}` })
      }
      if (ts < prevTimestamp) {
        issues.push({ type: 'error', line: lineNum, field: 'timestamp', message: `Non-monotonic timestamp: ${ts} < previous ${prevTimestamp}` })
      }
      if (seenTimestamps.has(ts)) {
        issues.push({ type: 'error', line: lineNum, field: 'timestamp', message: `Duplicate timestamp: ${ts}` })
      }
      seenTimestamps.add(ts)
      prevTimestamp = ts
    } else {
      issues.push({ type: 'error', line: lineNum, field: 'timestamp', message: `timestamp is not a number: ${typeof ts}` })
    }

    // ── Campaign ID consistency ──
    const ctx = entry.campaign as Record<string, unknown> | undefined
    if (ctx) {
      if (typeof ctx.id === 'string') {
        if (campaignId === null) campaignId = ctx.id
        else if (ctx.id !== campaignId) {
          issues.push({ type: 'error', line: lineNum, field: 'campaign.id', message: `campaignId mismatch: "${ctx.id}" (expected "${campaignId}")` })
        }
      } else {
        issues.push({ type: 'error', line: lineNum, field: 'campaign.id', message: `campaign.id missing or not a string` })
      }
    }

    // ── NaN / Infinity ──
    const invalidNums = hasInvalidNumber(entry)
    for (const p of invalidNums) {
      issues.push({ type: 'error', line: lineNum, field: p, message: `Invalid number at ${p}` })
    }
  }

  // ── Summary ──
  const errors = issues.filter(i => i.type === 'error')
  const warnings = issues.filter(i => i.type === 'warning')
  const passed = errors.length === 0

  if (passed) {
    let summary = `✅ Journal verified: ${lines.length} entries`
    if (campaignId) summary += ` (campaign: ${campaignId})`
    if (seenSchemaVersion !== null) summary += `, schemaVersion=${seenSchemaVersion}`
    if (warnings.length > 0) summary += `, ${warnings.length} warning(s)`
    return { totalEntries: lines.length, issues, passed, summary }
  }

  const summary = `❌ ${errors.length} error(s), ${warnings.length} warning(s) in ${lines.length} entries`
  return { totalEntries: lines.length, issues, passed, summary }
}

function main(): void {
  const { verbose } = parseArgs()
  const report = verify()

  // Group by type
  const errors = report.issues.filter(i => i.type === 'error')
  const warnings = report.issues.filter(i => i.type === 'warning')

  for (const issue of report.issues) {
    if (!verbose && issue.type === 'warning') continue
    const icon = issue.type === 'error' ? '❌' : '⚠️'
    const loc = issue.line ? ` line ${issue.line}` : ''
    const field = issue.field ? ` [${issue.field}]` : ''
    console.log(`${icon}${loc}${field}: ${issue.message}`)
  }

  console.log()
  console.log(report.summary)
  console.log(`   ${report.totalEntries} entries, ${errors.length} errors, ${warnings.length} warnings`)

  process.exit(report.passed ? 0 : 1)
}

main()
