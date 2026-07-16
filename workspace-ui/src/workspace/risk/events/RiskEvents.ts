/**
 * RiskEvents.ts — Risk Runtime event type definitions
 *
 * @since 4.7
 */

import type { RiskDecision } from '../types'
import type { OrderRequest } from '../../execution/types'

export type RiskEventType =
  | 'risk:allow'
  | 'risk:modify'
  | 'risk:reject'
  | 'risk:killswitch'
  | 'risk:killswitch_off'
  | 'risk:violation'
  | 'risk:warning'

export interface RiskEventPayload {
  'risk:allow': { order: OrderRequest; decision: RiskDecision }
  'risk:modify': { order: OrderRequest; decision: RiskDecision }
  'risk:reject': { order: OrderRequest; decision: RiskDecision }
  'risk:killswitch': { reason: string; triggeredBy: string }
  'risk:killswitch_off': Record<string, never>
  'risk:violation': { ruleId: string; message: string; orderId: string }
  'risk:warning': { ruleId: string; message: string; orderId: string }
}

export type RiskEventHandler<T extends RiskEventType = RiskEventType> =
  (payload: RiskEventPayload[T]) => void
