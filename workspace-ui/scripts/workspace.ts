#!/usr/bin/env node
/**
 * workspace — CLI для управления Trading Workspace Platform
 *
 * Usage:
 *   npx tsx scripts/workspace.ts start          # Запуск Workspace (foreground)
 *   npx tsx scripts/workspace.ts stop           # Graceful shutdown
 *   npx tsx scripts/workspace.ts status         # Краткий статус
 *   npx tsx scripts/workspace.ts health         # Детальное здоровье
 *   npx tsx scripts/workspace.ts safemode       # Включить Safe Mode
 *   npx tsx scripts/workspace.ts emergency-stop # Аварийная остановка
 *
 * State file: .workspace-state.json  — PID, конфиг
 * Health file: .workspace-health.json — последний health snapshot
 * Cmd file:   .workspace-cmd.json    — канал команд (→ start процесс)
 *
 * @since Sprint 5.8 Production Launch Gate
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const STATE_FILE = path.join(process.cwd(), '.workspace-state.json')
const HEALTH_FILE = path.join(process.cwd(), '.workspace-health.json')
const CMD_FILE = path.join(process.cwd(), '.workspace-cmd.json')

// ════════════════════════════════════════
// Helpers
// ════════════════════════════════════════

function readJSON<T>(file: string): T | null {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8')) as T
    }
  } catch { /* ignore */ }
  return null
}

function writeJSON(file: string, data: unknown): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

function removeFile(file: string): void {
  try { if (fs.existsSync(file)) fs.unlinkSync(file) } catch { /* ignore */ }
}

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19)
}

/** Write a one-shot command for the running workspace to pick up */
function writeCommand(command: string, reason?: string): void {
  writeJSON(CMD_FILE, { command, reason: reason ?? '', timestamp: Date.now() })
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function getRunningState(): {
  pid: number
  hostname: string
  timestamp: number
  script: string
} | null {
  return readJSON(STATE_FILE)
}

function requireRunning(): { pid: number } | never {
  const state = getRunningState()
  if (!state) {
    console.error('[workspace] ⛔ Нет запущенного Workspace (state file not found)')
    process.exit(1)
  }
  if (!isProcessAlive(state.pid)) {
    console.error(`[workspace] ⛔ Процесс ${state.pid} не запущен (stale lock)`)
    process.exit(1)
  }
  return { pid: state.pid }
}

// ════════════════════════════════════════
// Commands
// ════════════════════════════════════════

async function cmdStart(): Promise<void> {
  // Check for existing instance
  const existing = getRunningState()
  if (existing && isProcessAlive(existing.pid)) {
    console.error(`[workspace] ⛔ Workspace уже запущен (PID ${existing.pid})`)
    console.error(`[workspace]    Используйте: workspace stop | workspace status`)
    process.exit(1)
  }

  console.log(`[workspace] 🚀 Starting Workspace...`)
  console.log(`[workspace]    PID: ${process.pid}`)
  console.log(`[workspace]    CWD: ${process.cwd()}`)
  console.log(`[workspace]    Host: ${os.hostname()}`)

  // ── Write state ──
  writeJSON(STATE_FILE, {
    pid: process.pid,
    hostname: os.hostname(),
    timestamp: Date.now(),
    script: process.argv[1],
  })

  // ── Cleanup on exit ──
  const cleanup = () => {
    removeFile(STATE_FILE)
    removeFile(HEALTH_FILE)
    removeFile(CMD_FILE)
    process.exit(0)
  }
  process.on('SIGINT', () => { console.log(`\n[workspace] SIGINT — stopping...`); cleanup() })
  process.on('SIGTERM', cleanup)

  // ── Import workspace components ──
  // Dynamic import so CLI is fast for non-start commands
  const { WorkspaceBuilder } = await import('../src/workspace/trading/WorkspaceBuilder')
  const { ExecutionMode } = await import('../src/workspace/live/gateway/ExecutionMode')
  const { BUILTIN_RISK_RULES } = await import('../src/workspace/risk/builtins')
  const { BybitBrokerAdapter } = await import('../src/workspace/live/brokers/BybitBrokerAdapter')
  const { BybitExecutionGateway } = await import('../src/workspace/live/gateway/BybitExecutionGateway')
  const { BybitFeedAdapter } = await import('../src/workspace/live/adapters/BybitFeedAdapter')
  const { LiveFeedRuntime } = await import('../src/workspace/live/feed/LiveFeedRuntime')
  const { SmaCross } = await import('../src/workspace/strategy/definitions/SmaCross')
  const mode = (process.env.MODE ?? 'paper') as 'mainnet' | 'testnet' | 'paper'
  const symbols = (process.env.SYMBOLS ?? 'BTCUSDT').split(',').map(s => s.trim())
  const symbol = symbols[0]
  const testnet = mode === 'testnet'
  const paperBalance = parseInt(process.env.PAPER_BALANCE ?? '500', 10)

  console.log(`[workspace]    Mode: ${mode} | Symbols: ${symbols.join(',')}`)

  // ── Build feed (real Bybit WebSocket for all modes, paper execution for paper) ──
  const feed = new LiveFeedRuntime()
  feed.useAdapter(new BybitFeedAdapter())
  await feed.subscribe(symbol)

  // ── Choose gateway ──
  let gateway
  if (mode === 'paper') {
    const { PaperBrokerAdapter } = await import('../src/workspace/live/brokers/PaperBrokerAdapter')
    const { PaperExecutionGateway } = await import('../src/workspace/live/gateway/PaperExecutionGateway')
    const paperBroker = new PaperBrokerAdapter(feed, {
      symbols,
      initialBalance: paperBalance,
      commissionRate: 0.001,
    })
    gateway = new PaperExecutionGateway(paperBroker)
  } else {
    const broker = new BybitBrokerAdapter(feed, {
      symbols,
      testnet,
    })
    gateway = new BybitExecutionGateway(broker, {
      mode: testnet ? ExecutionMode.Testnet : ExecutionMode.Live,
      credentials: testnet
        ? { apiKey: process.env.BYBIT_API_KEY_TESTNET!, apiSecret: process.env.BYBIT_API_SECRET_TESTNET! }
        : { apiKey: process.env.BYBIT_API_KEY!, apiSecret: process.env.BYBIT_API_SECRET! },
    })
  }

  // ── Build Workspace ──
  const builder = new WorkspaceBuilder()
  builder
    .withConfig({ name: `workspace-${mode}`, mode: mode === 'paper' ? 'paper' as any : 'live' as any, symbols })
    .withGateway(gateway)
    .withRisk(BUILTIN_RISK_RULES)
    .withStrategy(new SmaCross())
    .withFeed(new BybitFeedAdapter())

  const ws = builder.build()

  // ── Command watcher (reads .workspace-cmd.json) ──
  const cmdWatcher = setInterval(async () => {
    const cmd = readJSON<{ command: string; reason?: string }>(CMD_FILE)
    if (!cmd) return

    removeFile(CMD_FILE) // Consume command

    switch (cmd.command) {
      case 'safemode':
        console.log(`[workspace] 🔒 Command received: enter Safe Mode`)
        ws.enterSafeMode()
        console.log(`[workspace] ✅ Safe Mode activated`)
        break
      case 'exit-safemode':
        console.log(`[workspace] 🔓 Command received: exit Safe Mode`)
        ws.exitSafeMode()
        console.log(`[workspace] ✅ Safe Mode deactivated`)
        break
      case 'emergency-stop':
        console.log(`[workspace] 🛑 Command received: EMERGENCY STOP`)
        await ws.emergencyStop()
        console.log(`[workspace] ✅ Emergency stop complete`)
        cleanup()
        break
      default:
        console.log(`[workspace] ❓ Unknown command: ${cmd.command}`)
    }
  }, 1000)

  // ── Health reporter (writes health snapshots) ──
  const healthInterval = setInterval(() => {
    try {
      const health = ws.health()
      writeJSON(HEALTH_FILE, { ...health, timestamp: Date.now() })
    } catch { /* best effort */ }
  }, 5000)

  // ── Start ──
  try {
    const report = await ws.start()
    console.log(`[workspace] ✅ Workspace started`)
    console.log(`[workspace]    Status: ${ws.health().status}`)
    console.log(`[workspace]    Gateway: ${ws.health().gatewayConnected ? 'connected' : 'disconnected'}`)
    console.log(`[workspace]    Recovery: ${report.healthy ? 'OK' : 'WARN'} (trades=${report.recoveredTrades}, orders=${report.recoveredOrders}, positions=${report.recoveredPositions})`)

    if (report.warnings.length) {
      for (const w of report.warnings) console.log(`[workspace]    ⚠ ${w}`)
    }
    if (report.errors.length) {
      for (const e of report.errors) console.log(`[workspace]    ❌ ${e}`)
    }

    // ── Main loop: keep alive ──
    console.log(`\n[workspace] 📡 Running. Ctrl+C to stop gracefully.`)
    console.log(`[workspace]    Commands: workspace status | workspace health | workspace safemode | workspace emergency-stop\n`)

    // Keep process alive — workspace runs on event loop
    await new Promise(() => {}) // never resolves
  } catch (err) {
    console.error(`[workspace] ❌ Start failed:`, err)
    cleanup()
  }

  // Cleanup on loop exit (unreachable)
  clearInterval(cmdWatcher)
  clearInterval(healthInterval)
  cleanup()
}

async function cmdStop(): Promise<void> {
  const state = requireRunning()
  console.log(`[workspace] Stopping Workspace (PID ${state.pid})...`)
  try {
    process.kill(state.pid, 'SIGTERM')
    console.log(`[workspace] ✅ SIGTERM sent to PID ${state.pid}`)
  } catch (err) {
    console.error(`[workspace] ❌ Failed to send SIGTERM:`, err)
    process.exit(1)
  }
}

async function cmdStatus(): Promise<void> {
  const state = getRunningState()
  if (!state) {
    console.log(`[workspace] 📴 Workspace не запущен`)
    process.exit(0)
  }

  const alive = isProcessAlive(state.pid)
  const health = readJSON<any>(HEALTH_FILE)

  console.log(`[workspace] Workspace Status`)
  console.log(`──────────────`)
  console.log(`  PID:      ${state.pid}`)
  console.log(`  Host:     ${state.hostname}`)
  console.log(`  Alive:    ${alive ? '✅ yes' : '❌ no'}`)
  if (health) {
    console.log(`  Status:   ${health.status ?? 'unknown'}`)
    console.log(`  Uptime:   ${health.uptimeMs ? `${(health.uptimeMs / 1000).toFixed(0)}s` : 'N/A'}`)
    console.log(`  Gateway:  ${health.gatewayConnected ? '✅ connected' : '❌ disconnected'}`)
    console.log(`  SafeMode: ${health.safeMode ? '🔒 ON' : '✅ OFF'}`)
    if (health.recoveryReport) {
      const r = health.recoveryReport
      console.log(`  Recovery: trades=${r.recoveredTrades} orders=${r.recoveredOrders} positions=${r.recoveredPositions} healthy=${r.healthy}`)
    }
  }
}

async function cmdHealth(): Promise<void> {
  const state = getRunningState()
  if (!state) {
    console.log(`[workspace] 📴 Workspace не запущен`)
    process.exit(0)
  }

  const health = readJSON<any>(HEALTH_FILE)
  const alive = isProcessAlive(state.pid)

  if (!health) {
    console.log(`[workspace] Workspace запущен (PID ${state.pid}), но health snapshot ещё не получен`)
    console.log(`[workspace] Попробуйте через несколько секунд`)
    process.exit(0)
  }

  console.log(`\n╔══════════════════════════════════════╗`)
  console.log(`║   Workspace Health Report            ║`)
  console.log(`╚══════════════════════════════════════╝`)
  console.log(`  PID:          ${state.pid}${alive ? '' : ' (DEAD)'}`)
  console.log(`  Status:       ${health.status}`)
  console.log(`  Uptime:       ${(health.uptimeMs / 1000).toFixed(0)}s (${(health.uptimeMs / 60000).toFixed(1)}m)`)
  console.log(`  Gateway:      ${health.gatewayConnected ? '✅ connected' : '❌ disconnected'}`)
  console.log(`  Safe Mode:    ${health.safeMode ? '🔒 ON' : '✅ OFF'}`)
  console.log(`  Last update:  ${new Date(health.timestamp ?? Date.now()).toISOString()}`)
  console.log(``)
  console.log(`  Runtimes:`)
  if (health.runtimes) {
    for (const [id, status] of Object.entries(health.runtimes)) {
      const icon = status === 'running' ? '✅' : status === 'error' ? '❌' : '⏹'
      console.log(`    ${icon} ${id.padEnd(12)} ${status}`)
    }
  }
  if (health.recoveryReport) {
    const r = health.recoveryReport
    console.log(``)
    console.log(`  Recovery Report:`)
    console.log(`    Healthy:     ${r.healthy ? '✅' : '❌'}`)
    console.log(`    Trades:      ${r.recoveredTrades}`)
    console.log(`    Orders:      ${r.recoveredOrders}`)
    console.log(`    Positions:   ${r.recoveredPositions}`)
    console.log(`    Duration:    ${r.durationMs}ms`)
    if (r.warnings?.length) {
      console.log(`    Warnings (${r.warnings.length}):`)
      for (const w of r.warnings) console.log(`      ⚠ ${w}`)
    }
    if (r.errors?.length) {
      console.log(`    Errors (${r.errors.length}):`)
      for (const e of r.errors) console.log(`      ❌ ${e}`)
    }
  }
  console.log(``)
}

async function cmdSafemode(): Promise<void> {
  requireRunning()
  console.log(`[workspace] 🔒 Sending Safe Mode command...`)
  writeCommand('safemode', 'manual_cli')
  console.log(`[workspace] ✅ Command sent. Workspace войдёт в Safe Mode в течение 1 секунды.`)
}

async function cmdEmergencyStop(): Promise<void> {
  requireRunning()
  console.log(`[workspace] 🛑 Sending EMERGENCY STOP command...`)
  console.log(`[workspace]    Это отменит все ордера и закроет позиции.`)
  writeCommand('emergency-stop', 'manual_cli')
  console.log(`[workspace] ✅ Command sent. Workspace выполнит аварийную остановку.`)
}

// ════════════════════════════════════════
// Main
// ════════════════════════════════════════

async function main(): Promise<void> {
  // Auto-load .env.mainnet or .env.testnet based on MODE
  const mode = (process.env.MODE ?? 'paper') as 'mainnet' | 'testnet' | 'paper'
  // Auto-load .env.mainnet or .env.testnet from working directory
  if (mode !== 'paper') {
    const envFile = mode === 'mainnet' ? '.env.mainnet' : '.env.testnet'
    const envPath = path.join(process.cwd(), envFile)
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8')
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const k = trimmed.slice(0, eqIdx).trim()
        const v = trimmed.slice(eqIdx + 1).trim()
        if (!process.env[k]) process.env[k] = v
      }
    }
  }

  const cmd = process.argv[2]

  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(`
Usage: npx tsx scripts/workspace.ts <command>

Commands:
  start           Запуск Workspace (foreground, Ctrl+C для остановки)
  stop            Graceful shutdown (SIGTERM)
  status          Краткий статус (PID, alive, статус)
  health          Детальное здоровье (runtimes, recovery, gateway)
  safemode        Включить Safe Mode (блокирует новые сделки)
  emergency-stop  Аварийная остановка (отменяет ордера, закрывает позиции)

Environment:
  MODE=paper|testnet|mainnet          Режим (default: paper)
  SYMBOLS=BTCUSDT                     Торгуемый символ (default: BTCUSDT)
  PAPER_BALANCE=500                   Баланс для paper mode (default: 500)
  BYBIT_API_KEY / BYBIT_API_SECRET    API ключи для mainnet/testnet
  BYBIT_API_KEY_TESTNET / BYBIT_API_SECRET_TESTNET

Examples:
  npx tsx scripts/workspace.ts start
  MODE=mainnet SYMBOLS=XRPUSDT npx tsx scripts/workspace.ts start
  npx tsx scripts/workspace.ts status
  npx tsx scripts/workspace.ts safemode
  npx tsx scripts/workspace.ts emergency-stop
`)
    process.exit(0)
  }

  switch (cmd) {
    case 'start':
      await cmdStart()
      break
    case 'stop':
      await cmdStop()
      break
    case 'status':
      await cmdStatus()
      break
    case 'health':
      await cmdHealth()
      break
    case 'safemode':
      await cmdSafemode()
      break
    case 'emergency-stop':
      await cmdEmergencyStop()
      break
    default:
      console.error(`[workspace] ❌ Неизвестная команда: "${cmd}"`)
      console.error(`[workspace]    Используйте: workspace --help`)
      process.exit(1)
  }
}

main().catch((err) => {
  console.error('[workspace] ❌ Fatal error:', err)
  process.exit(1)
})
