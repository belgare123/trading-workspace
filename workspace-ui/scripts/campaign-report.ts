#!/usr/bin/env node
/**
 * campaign-report.ts — CLI for generating campaign reports
 *
 * Usage:
 *   npx tsx scripts/campaign-report.ts                           # latest campaign
 *   npx tsx scripts/campaign-report.ts --burnin                  # longest-running campaign
 *   npx tsx scripts/campaign-report.ts --dir /path/to/metrics    # custom dir
 *   npx tsx scripts/campaign-report.ts --last 24h                # last 24 hours
 *   npx tsx scripts/campaign-report.ts --output report.md        # save to file
 *   npx tsx scripts/campaign-report.ts --list-campaigns          # list discovered campaigns
 *
 * @since M2-02
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { ReportEngine } from '../src/workspace/campaign/reports/ReportEngine'
import { MarkdownRenderer } from '../src/workspace/campaign/reports/MarkdownRenderer'

function parseArgs(): {
  dir: string
  after?: number
  before?: number
  output?: string
  last?: number
  watch?: boolean
  burnIn?: boolean
  listCampaigns?: boolean
} {
  const args = process.argv.slice(2)
  const parsed: ReturnType<typeof parseArgs> = {
    dir: path.join(os.tmpdir(), 'paper-campaign', 'metrics'),
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dir':
      case '-d':
        parsed.dir = args[++i]
        break
      case '--after':
        parsed.after = parseTimeArg(args[++i])
        break
      case '--before':
        parsed.before = parseTimeArg(args[++i])
        break
      case '--last':
        parsed.last = parseDuration(args[++i])
        break
      case '--output':
      case '-o':
        parsed.output = args[++i]
        break
      case '--watch':
      case '-w':
        parsed.watch = true
        break
      case '--burnin':
      case '-b':
        parsed.burnIn = true
        break
      case '--list-campaigns':
      case '-l':
        parsed.listCampaigns = true
        break
      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
    }
  }

  return parsed
}

function parseTimeArg(s: string): number {
  if (/^\d+$/.test(s)) return parseInt(s, 10)
  return new Date(s).getTime()
}

function parseDuration(s: string): number {
  const match = s.match(/^(\d+)(h|m|s)?$/)
  if (!match) return 3600 * 1000 // default 1h
  const val = parseInt(match[1], 10)
  const unit = match[2] || 'h'
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000 }
  return val * (multipliers[unit] || 3600000)
}

function printHelp(): void {
  console.log(`
Usage: npx tsx scripts/campaign-report.ts [options]

Options:
  --dir, -d <path>       Campaign metrics directory (default: temp dir)
  --after <ts|ISO>       Include snapshots after this timestamp
  --before <ts|ISO>      Include snapshots before this timestamp
  --last <N>h|m|s        Include only last N hours/minutes/seconds of data
  --burnin, -b           Auto-select the longest-running campaign (burn-in)
  --list-campaigns, -l   List discovered campaign runs and exit
  --output, -o <file>    Write report to file instead of stdout
  --watch, -w            Watch mode: regenerate report every 60s
  --help, -h             Show this help
`)
}

async function main(): Promise<void> {
  const opts = parseArgs()
  const engine = new ReportEngine({ dir: opts.dir })

  // List campaigns mode
  if (opts.listCampaigns) {
    const campaigns = engine.discoverCampaigns()
    console.log('Discovered campaign runs:\n')
    console.log('  ID'.padEnd(24) + 'Snapshots'.padEnd(12) + 'Duration'.padEnd(12) + 'Trades'.padEnd(10) + 'Time range')
    console.log('  ' + '─'.repeat(80))
    for (const c of campaigns) {
      const start = new Date(c.startTime).toISOString().replace('T', ' ').slice(0, 19)
      const end = new Date(c.endTime).toISOString().replace('T', ' ').slice(11, 19)
      console.log(
        `  ${c.id.padEnd(22)} ` +
        `${String(c.snapshotCount).padStart(8)}  ` +
        `${c.durationHours.toFixed(1).padStart(6)}h  ` +
        `${String(c.trades).padStart(6)}  ` +
        `${start} → ${end}`
      )
    }
    return
  }

  const renderer = new MarkdownRenderer()

  function generateAndOutput(): void {
    const filter: any = {}
    if (opts.burnIn) filter.burnIn = true
    if (opts.after) filter.after = opts.after
    if (opts.before) filter.before = opts.before
    if (opts.last) {
      filter.after = Date.now() - opts.last
    }

    const data = engine.generate(filter)
    const report = renderer.render(data)

    if (opts.output) {
      fs.writeFileSync(opts.output, report, 'utf-8')
      console.log(`📄 Report saved to ${opts.output}`)
      console.log(`   ${data.snapshotsUsed} snapshots, ${data.timeframe.durationHours.toFixed(1)}h window`)
    } else {
      console.log(report)
    }
  }

  if (opts.watch) {
    console.log('📊 Campaign Report — watch mode (refresh every 60s)')
    console.log('   Press Ctrl+C to stop\n')
    generateAndOutput()
    setInterval(generateAndOutput, 60_000)
  } else {
    generateAndOutput()
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
