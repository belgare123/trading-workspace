/**
 * CampaignReporter.ts — Format and print campaign reports
 *
 * @since 4.9
 */

import type { BurnInResult, CampaignDailyReport, CampaignFinalReport, CampaignStage } from './types'

export class CampaignReporter {
  // ── Burn-in Result ──

  static printBurnInResult(result: BurnInResult): void {
    console.log('  Burn-in Results:')
    console.log(`  Duration: ${(result.durationMs / 1000 / 60).toFixed(0)} minutes`)
    console.log()

    const labels: Record<string, string> = {
      no_crashes: '  0 аварийных остановок',
      no_lost_positions: '  0 потерянных позиций',
      no_desync: '  0 рассинхронизаций',
      stable_memory: '  Стабильное потребление памяти',
      no_pipeline_exceptions: '  0 необработанных исключений',
      gateway_connected: '  GatewayRuntime стабильно подключён',
      market_data_fresh: '  Рыночные данные поступают (<60с)',
    }

    for (const [key, passed] of Object.entries(result.criteria)) {
      const label = labels[key] ?? `  ${key}`
      console.log(`  ${passed ? '✅' : '❌'} ${label}`)
    }

    console.log()
    console.log(`  Result: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`)
    if (result.rejectionReason) {
      console.log(`  Reason: ${result.rejectionReason}`)
    }

    // Print incidents
    if (result.incidents.length > 0) {
      console.log()
      console.log(`  Incidents during burn-in (${result.incidents.length}):`)
      for (const inc of result.incidents.slice(-10)) {
        const icon = inc.severity === 'critical' ? '🔴' : inc.severity === 'warning' ? '🟡' : 'ℹ️'
        console.log(`    ${icon} [${new Date(inc.timestamp).toISOString()}] ${inc.message}`)
      }
    }
  }

  // ── Daily Report ──

  static printDailyReport(report: CampaignDailyReport): void {
    const h = report.currentHealth

    console.log('┌──────────────────────────────────────────────────┐')
    console.log(`│   📋 Daily Report — Day ${report.day} (${report.date})`)
    console.log('├──────────────────────────────────────────────────┤')
    console.log(`│  Period: ${(report.durationMs / 1000 / 60).toFixed(0)} minutes`)
    console.log(`│  Status: ${h.status === 'healthy' ? '✅ Healthy' : h.status === 'degraded' ? '⚠️ Degraded' : '❌ Critical'}`)
    console.log(`│  Uptime: ${Math.round(h.uptime / 60)} minutes`)
    console.log(`│  Memory: ${h.memoryMB} MB (peak: ${report.peakMemoryMB} MB)`)
    console.log(`│  Reconnects: ${h.reconnectCount}`)
    console.log(`│  Exceptions: ${h.exceptionCount}`)
    console.log(`│  Avg latency: ${h.avgLatencyMs60s}ms | Max: ${h.maxLatencyMs}ms`)
    console.log(`│  Gateway: ${h.gatewayConnected ? '✅ Connected' : '❌ Disconnected'}`)
    console.log(`│  Market data age: ${h.marketDataAge}s`)
    console.log(`│  Orders: ${report.totalOrders} | Fills: ${report.totalFills}`)
    console.log(`│  PnL: ${report.totalPnl >= 0 ? '+' : ''}${report.totalPnl.toFixed(2)} USDT`)
    console.log('└──────────────────────────────────────────────────┘')

    if (report.incidents.length > 0) {
      console.log(`  Incidents (${report.incidents.length}):`)
      for (const inc of report.incidents.slice(-3)) {
        const icon = inc.severity === 'critical' ? '🔴' : inc.severity === 'warning' ? '🟡' : 'ℹ️'
        console.log(`    ${icon} ${inc.message}`)
      }
    }
  }

  // ── Final Report ──

  static printFinalReport(report: CampaignFinalReport): void {
    console.log()
    console.log('╔══════════════════════════════════════════════════╗')
    console.log('║   Paper Campaign — Final Report                ║')
    console.log('╚══════════════════════════════════════════════════╝')
    console.log()

    const icon = report.success ? '✅' : '❌'
    console.log(`${icon} Overall: ${report.success ? 'SUCCESS' : 'FAILED'}`)
    console.log(`Stage: ${report.stage}`)
    console.log()

    // Burn-in summary
    console.log('── Burn-in ──')
    console.log(`  ${report.burnIn.passed ? '✅' : '❌'} ${report.burnIn.passed ? 'Passed' : 'Failed'}`)
    console.log(`  Duration: ${(report.burnIn.durationMs / 1000 / 60).toFixed(0)} min`)
    console.log(`  Incidents: ${report.burnIn.incidents.length}`)

    if (report.burnIn.rejectionReason) {
      console.log(`  Reason: ${report.burnIn.rejectionReason}`)
    }

    // Campaign summary
    if (report.dailyReports.length > 0) {
      console.log()
      console.log('── Campaign days ──')
      for (const dr of report.dailyReports) {
        const d = dr.currentHealth
        console.log(
          `  Day ${dr.day}: ${d.status} | mem=${d.memoryMB}MB ` +
          `reconn=${d.reconnectCount} ex=${d.exceptionCount} ` +
          `lat=${d.avgLatencyMs60s}ms`
        )
      }
    }

    // Totals
    console.log()
    console.log('── Totals ──')
    console.log(`  Peak memory: ${report.peakMemoryMB} MB`)
    console.log(`  Total incidents: ${report.totalIncidents} (${report.criticalIncidents} critical)`)
    console.log(`  Total orders: ${report.totalOrders}`)
    console.log(`  Total PnL: ${report.totalPnl >= 0 ? '+' : ''}${report.totalPnl.toFixed(2)} USDT`)
  }
}
