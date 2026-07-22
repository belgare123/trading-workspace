/**
 * AlertEngine — rule-based alert evaluation.
 *
 * Inspired by Prometheus AlertManager but in-process:
 * each rule evaluates a condition; when it fires, the engine
 * calls registered notify callbacks with the alert payload.
 *
 * Alert lifecycle:
 *   pending → firing → resolved
 *
 * A rule has:
 *   - condition (a function that returns truthy when alerting)
 *   - severity (warn/alert/critical)
 *   - summary + description
 *   - optional cooldown to prevent duplicates
 *
 * Usage:
 *   const alerts = new AlertEngine()
 *   alerts.addRule({
 *     name: 'gateway_disconnected',
 *     summary: 'Gateway disconnected',
 *     severity: 'critical',
 *     condition: () => !gateway.connected,
 *     cooldownMs: 30_000,
 *   })
 *
 * @since 6.1.0
 */

/* ── Types ── */

export type AlertSeverity = 'warn' | 'alert' | 'critical'

export interface AlertRule {
  /** Unique rule name */
  name: string
  /** One-line summary */
  summary: string
  /** Human-readable description (can include template placeholders) */
  description?: string
  /** Severity level */
  severity: AlertSeverity
  /** Condition function — return truthy to fire */
  condition: () => boolean | number | string | Promise<boolean | number | string>
  /** Labels for grouping */
  labels?: Record<string, string>
  /** Minimum interval between firing the same alert (ms) */
  cooldownMs?: number
}

export interface AlertEvent {
  id: string
  ruleName: string
  summary: string
  description?: string
  severity: AlertSeverity
  value: boolean | number | string
  labels: Record<string, string>
  firedAt: string
  resolvedAt: string | null
  status: 'firing' | 'resolved'
  firingCount: number
}

export type AlertNotifyFn = (event: AlertEvent) => void

/* ── Engine ── */

export class AlertEngine {
  private readonly _rules: AlertRule[] = []
  private readonly _cooldowns = new Map<string, number>()
  private readonly _firing = new Map<string, Omit<AlertEvent, 'status' | 'resolvedAt'>>()
  private readonly _history: AlertEvent[] = []
  private readonly _notifyFns: AlertNotifyFn[] = []
  private _firingCount = 0
  private _evaluationCount = 0

  /** Add a notification callback */
  onAlert(fn: AlertNotifyFn): void {
    this._notifyFns.push(fn)
  }

  /** Add a rule */
  addRule(rule: AlertRule): void {
    this._rules.push(rule)
  }

  /** Remove a rule by name */
  removeRule(name: string): void {
    const idx = this._rules.findIndex(r => r.name === name)
    if (idx >= 0) this._rules.splice(idx, 1)
  }

  /** Evaluate all rules. Call this periodically (e.g. every 10s). */
  async evaluate(): Promise<AlertEvent[]> {
    const fired: AlertEvent[] = []
    this._evaluationCount++

    for (const rule of this._rules) {
      // Cooldown check
      const lastFire = this._cooldowns.get(rule.name) ?? 0
      const cooldown = rule.cooldownMs ?? 0
      if (Date.now() - lastFire < cooldown) continue

      try {
        const value = await rule.condition()
        const isFiring = !!value

        if (isFiring) {
          // Create alert event
          const now = new Date().toISOString()
          const labels = rule.labels ?? {}
          const event: AlertEvent = {
            id: `${rule.name}_${Date.now()}`,
            ruleName: rule.name,
            summary: rule.summary,
            description: rule.description,
            severity: rule.severity,
            value,
            labels,
            firedAt: now,
            resolvedAt: null,
            status: 'firing',
            firingCount: (this._firing.get(rule.name)?.firingCount ?? 0) + 1,
          }

          this._firing.set(rule.name, event)
          this._cooldowns.set(rule.name, Date.now())
          this._history.push(event)
          this._firingCount++

          // Keep history cap at 1000
          if (this._history.length > 1000) {
            this._history.shift()
          }

          for (const fn of this._notifyFns) {
            try { fn(event) } catch { /* notify fn must not throw */ }
          }

          fired.push(event)
        } else {
          // Resolve if was firing
          const prev = this._firing.get(rule.name)
          if (prev && !prev.resolvedAt) {
            const resolved: AlertEvent = {
              ...prev,
              status: 'resolved',
              resolvedAt: new Date().toISOString(),
            }
            this._history.push(resolved)
            if (this._history.length > 1000) this._history.shift()
            this._firing.delete(rule.name)
          }
        }
      } catch (err) {
        // If condition throws, treat as firing with critical severity
        const now = new Date().toISOString()
        const event: AlertEvent = {
          id: `${rule.name}_err_${Date.now()}`,
          ruleName: rule.name,
          summary: `Rule error: ${rule.summary}`,
          description: `Condition threw: ${err instanceof Error ? err.message : String(err)}`,
          severity: 'critical',
          value: true,
          labels: { error: 'true', ...(rule.labels ?? {}) },
          firedAt: now,
          resolvedAt: null,
          status: 'firing',
          firingCount: (this._firing.get(rule.name)?.firingCount ?? 0) + 1,
        }
        this._firing.set(rule.name, event)
        fired.push(event)
      }
    }

    return fired
  }

  /** Get all rules */
  get rules(): readonly AlertRule[] {
    return this._rules
  }

  /** Get currently firing alerts */
  getFiring(): AlertEvent[] {
    return this._history.filter(e => e.status === 'firing')
  }

  /** Get recent alert history */
  getHistory(limit = 50): AlertEvent[] {
    return this._history.slice(-limit).reverse()
  }

  /** Current number of firing alerts */
  get count(): number {
    return this._firing.size
  }

  /** Total evaluations performed */
  get evaluations(): number {
    return this._evaluationCount
  }

  /** Total alerts fired */
  get totalFired(): number {
    return this._firingCount
  }
}
