// ── PositionStateCondition — checks position state via ExecutionContext ──
//
// Contextual condition: examines the current position state from
// ExecutionContext.PositionContext.
//
// Modes:
//   'open'       — a position is open for the given symbol
//   'closed'     — no position for the symbol
//   'direction'  — position in a specific direction (long/short)
//   'count'      — number of open positions meets threshold
//
// Parameters:
//   symbol    - symbol to check
//   mode      - check mode ('open' | 'closed' | 'direction' | 'count')
//   direction - direction for 'direction' mode ('long' | 'short')
//   minCount  - minimum positions for 'count' mode
//
// @since 3.4.4

import type { ConditionDefinition, ConditionEvaluationOutput } from '../definition/ConditionDefinition'
import type { ConditionInput } from '../types'

export const PositionStateCondition: ConditionDefinition = {
  id: 'position-state',
  name: 'Position State',
  description: 'Checks the current position state from ExecutionContext',
  version: '1.0.0',
  parameters: [
    { id: 'symbol', name: 'Symbol', type: 'string', default: 'BTC/USDT', description: 'Trading symbol' },
    { id: 'mode', name: 'Check Mode', type: 'select', default: 'open', description: 'What to check', options: ['open', 'closed', 'direction', 'count'] },
    { id: 'direction', name: 'Direction', type: 'select', default: 'long', description: 'Position direction', options: ['long', 'short'] },
    { id: 'minCount', name: 'Min Positions', type: 'number', default: 1, description: 'Minimum open positions', min: 1 },
  ],

  async evaluate(input: ConditionInput): Promise<ConditionEvaluationOutput> {
    const { ctx, params } = input
    const symbol = (params.symbol as string) ?? 'BTC/USDT'
    const mode = (params.mode as string) ?? 'open'
    const direction = (params.direction as string) ?? 'long'
    const minCount = (params.minCount as number) ?? 1

    switch (mode) {
      case 'open': {
        const pos = await ctx.position.current(symbol)
        const hasPosition = pos != null
        return {
          result: {
            satisfied: hasPosition,
            score: hasPosition ? 1 : 0,
            reason: hasPosition ? `Position open for ${symbol}` : `No position for ${symbol}`,
          },
          nextState: {},
        }
      }

      case 'closed': {
        const pos = await ctx.position.current(symbol)
        const noPosition = pos == null
        return {
          result: {
            satisfied: noPosition,
            score: noPosition ? 1 : 0,
            reason: noPosition ? `No position for ${symbol}` : `Position open for ${symbol}`,
          },
          nextState: {},
        }
      }

      case 'direction': {
        const pos = await ctx.position.current(symbol)
        const inDirection = pos?.direction === direction
        return {
          result: {
            satisfied: inDirection,
            score: inDirection ? 1 : 0,
            reason: inDirection
              ? `Position is ${direction} for ${symbol}`
              : `Position is not ${direction} for ${symbol} (${pos?.direction ?? 'none'})`,
          },
          nextState: {},
        }
      }

      case 'count': {
        const allPositions = await ctx.position.all()
        const count = allPositions.length
        const meetsThreshold = count >= minCount
        return {
          result: {
            satisfied: meetsThreshold,
            score: meetsThreshold ? Math.min(count / minCount, 1) : count / minCount,
            reason: `Open positions: ${count} (need ${minCount})`,
          },
          nextState: {},
        }
      }

      default:
        return { result: { satisfied: false, reason: `Unknown mode: ${mode}` }, nextState: {} }
    }
  },
}
