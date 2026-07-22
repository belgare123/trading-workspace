/**
 * TelemetryRuntime tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TelemetryRuntime, telemetryRuntime, getTelemetryRuntime } from '../TelemetryRuntime'
import { exporterRegistry } from '../export'

describe('TelemetryRuntime', () => {
  beforeEach(() => {
    TelemetryRuntime.reset()
  })

  afterEach(() => {
    const rt = getTelemetryRuntime()
    rt.stop()
    TelemetryRuntime.reset()
  })

  it('is a singleton via Proxy', () => {
    expect(telemetryRuntime).toBeDefined()
    expect(telemetryRuntime.registry).toBeDefined()
  })

  it('starts and stops the registry', () => {
    const rt = getTelemetryRuntime()
    expect(rt.running).toBe(false)

    rt.start(50_000)
    expect(rt.running).toBe(true)

    rt.stop()
    expect(rt.running).toBe(false)
  })

  it('does not double-start', () => {
    const rt = getTelemetryRuntime()
    rt.start(50_000)
    rt.start(30_000) // second call ignored
    expect(rt.running).toBe(true)
    rt.stop()
  })

  it('auto-starts when configured', () => {
    TelemetryRuntime.reset()
    const rt = new TelemetryRuntime({ autoStart: true, pushIntervalMs: 50_000 })
    expect(rt.running).toBe(true)
    rt.stop()
  })

  it('reports health before start', () => {
    const rt = getTelemetryRuntime()
    const h = rt.health()
    expect(h).toHaveProperty('healthy')
    expect(h).toHaveProperty('running', false)
    expect(h).toHaveProperty('exporter_count')
    expect(h).toHaveProperty('resource_labels')
    expect(h.resource_labels).toHaveProperty('service', 'workspace-ui')
  })

  it('reports health after start', () => {
    const rt = getTelemetryRuntime()
    rt.start(50_000)
    const h = rt.health()
    expect(h.running).toBe(true)
    expect(h.uptime_seconds).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(h.exporters)).toBe(true)
    rt.stop()
  })

  it('has uptimeSeconds zero before start', () => {
    const rt = getTelemetryRuntime()
    expect(rt.uptimeSeconds).toBe(0)
  })

  it('has uptimeSeconds > 0 after start', () => {
    const rt = getTelemetryRuntime()
    rt.start(50_000)
    expect(rt.uptimeSeconds).toBeGreaterThanOrEqual(0)
    rt.stop()
  })

  it('provides resourceLabels convenience', () => {
    const rt = getTelemetryRuntime()
    const labels = rt.resourceLabels
    expect(labels.service).toBe('workspace-ui')
    expect(labels.exchange).toBe('unknown')
    expect(labels.environment).toBe('dev')
  })

  it('getTelemetryRuntime returns the same instance', () => {
    const a = getTelemetryRuntime()
    const b = getTelemetryRuntime()
    expect(a).toBe(b)
  })

  it('reset creates a new instance', () => {
    const a = getTelemetryRuntime()
    TelemetryRuntime.reset()
    const b = getTelemetryRuntime()
    expect(a).not.toBe(b)
  })
})
