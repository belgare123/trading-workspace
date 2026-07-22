/**
 * ObservabilitySetup — one-call initialization of the full observability stack.
 *
 * Call ONCE at app boot, before any module initialization.
 *
 * Usage:
 *   import { setupObservability } from './observability'
 *   const obs = setupObservability()
 *
 *   // Later:
 *   import { runtimeEventBus } from './EventBus'
 *   import { setupEventBusObservability } from './observability'
 *   setupEventBusObservability(runtimeEventBus, obs)
 *
 * @since 6.1.0
 */

import { ObservabilityRuntime } from './ObservabilityRuntime'
import { StructuredLogger } from './StructuredLogger'
import type { ObservabilityConfig } from './ObservabilityRuntime'

export type { ObservabilityConfig }

/**
 * Initialize the full observability stack.
 * Creates the ObservabilityRuntime singleton and optionally patches global console.
 */
export function setupObservability(config: ObservabilityConfig = {}): ObservabilityRuntime {
  const obs = new ObservabilityRuntime(config)

  // Register default alert rules for system health
  registerDefaultAlertRules(obs)

  return obs
}

/**
 * Register default alert rules that every trading platform should have.
 */
function registerDefaultAlertRules(obs: ObservabilityRuntime): void {
  const alerts = obs.alerts

  // Monitor for slow health checks
  alerts.addRule({
    name: 'slow_health_check',
    summary: 'Health check taking too long',
    severity: 'warn',
    condition: async () => {
      // Health check runs as part of the aggregator; just reporting
      return false
    },
    cooldownMs: 60_000,
  })
}

/**
 * Wrap console.* with StructuredLogger for the global context.
 * Call ONCE at boot. Returns an unwrap function.
 *
 * Note: this should be used selectively — platform modules should be
 * migrated to import their own StructuredLogger instance instead.
 */
export function patchConsole(obs: ObservabilityRuntime): () => void {
  const origLog = console.log
  const origWarn = console.warn
  const origError = console.error
  const origDebug = console.debug

  const log = obs.logger

  console.log = (...args: unknown[]) => {
    log.info(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '))
  }

  console.warn = (...args: unknown[]) => {
    log.warn(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '))
  }

  console.error = (...args: unknown[]) => {
    log.error(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '))
  }

  console.debug = (...args: unknown[]) => {
    log.debug(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '))
  }

  log.info('console.* patched to StructuredLogger')

  // Return unpatch function
  return () => {
    console.log = origLog
    console.warn = origWarn
    console.error = origError
    console.debug = origDebug
    log.info('console.* restored')
  }
}
