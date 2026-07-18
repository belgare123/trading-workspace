/**
 * CampaignSupervisor.test.ts — Tests for evaluateBurnIn criteria
 *
 * Test plan:
 *   1. ALL criteria met → PASS
 *   2. Gateway disconnected → FAIL
 *   3. Market data stale → FAIL
 *
 * @since 4.9D.1
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CampaignSupervisor } from '../CampaignSupervisor'

describe('evaluateBurnIn', () => {
  let supervisor: CampaignSupervisor

  beforeEach(() => {
    supervisor = new CampaignSupervisor()
  })

  it('should PASS when gateway connected, market data fresh, no pipeline exceptions', () => {
    supervisor.recordGatewayState(true)
    supervisor.recordMarketData(Date.now())

    const result = supervisor.evaluateBurnIn(24 * 60 * 60 * 1000) // 24h elapsed

    expect(result.passed).toBe(true)
    expect(result.criteria.gateway_connected).toBe(true)
    expect(result.criteria.market_data_fresh).toBe(true)
    expect(result.criteria.no_pipeline_exceptions).toBe(true)
  })

  it('should FAIL when gateway is not connected', () => {
    supervisor.recordGatewayState(false)
    supervisor.recordMarketData(Date.now())

    const result = supervisor.evaluateBurnIn(24 * 60 * 60 * 1000)

    expect(result.passed).toBe(false)
    expect(result.criteria.gateway_connected).toBe(false)
    expect(result.rejectionReason).toContain('GatewayRuntime')
  })

  it('should FAIL when market data is stale (> MARKET_DATA_STALL_MS)', () => {
    supervisor.recordGatewayState(true)
    // Set market data timestamp 2 minutes ago (> 60s threshold)
    supervisor.recordMarketData(Date.now() - 120_000)

    const result = supervisor.evaluateBurnIn(24 * 60 * 60 * 1000)

    expect(result.passed).toBe(false)
    expect(result.criteria.market_data_fresh).toBe(false)
    expect(result.rejectionReason).toContain('Рыночные данные')
  })
})
