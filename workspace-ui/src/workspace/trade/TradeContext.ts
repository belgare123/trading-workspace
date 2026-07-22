// ── Trade Domain: TradeContext ──

import type { Trade } from './Trade'
import type { Order } from './Order'

/**
 * Market data snapshot at decision time.
 * Minimal — enough for exit/entry decisions.
 */
export interface MarketSnapshot {
  symbol: string
  price: number
  bid: number
  ask: number
  spread: number
  timestamp: number
  volume24h?: number
  change24h?: number
}

/**
 * Wallet snapshot at decision time.
 */
export interface WalletSnapshot {
  total: number
  free: number
  reserved: number
  margin: number
  leverage: number
  exposure: number
  currency: string
}

/**
 * Risk state snapshot at decision time.
 */
export interface RiskSnapshot {
  dailyLoss: number
  dailyLossLimit: number
  drawdown: number
  drawdownLimit: number
  openPositions: number
  maxOpenPositions: number
  isKillSwitchActive: boolean
}

/**
 * Strategy metadata at decision time.
 */
export interface StrategyMeta {
  id: string
  name: string
  version?: string
}

/**
 * TradeContext — single object bundling everything needed for exit/entry decisions.
 *
 * Instead of passing 6+ parameters to every policy or decision function,
 * pass one TradeContext. This is the primary input to ExitPolicy.evaluate(),
 * RiskRuntime checks, and WalletManager calculations.
 */
export interface TradeContext {
  /** The trade being evaluated */
  trade: Trade

  /** Current market data */
  market: {
    symbol: string
    price: number
    bid: number
    ask: number
    spread: number
    timestamp: number
    volume24h?: number
    change24h?: number
  }

  /** Current wallet state */
  wallet: {
    total: number
    free: number
    reserved: number
    margin: number
    leverage: number
    exposure: number
    currency: string
  }

  /** Current risk state */
  risk: {
    dailyLoss: number
    dailyLossLimit: number
    drawdown: number
    drawdownLimit: number
    openPositions: number
    maxOpenPositions: number
    isKillSwitchActive: boolean
  }

  /** Recent trade history (last N trades) */
  history: {
    trades: Trade[]
    totalTrades: number
    winRate: number
    totalPnL: number
  }

  /** Strategy metadata */
  strategy: {
    id: string
    name: string
    version?: string
  }
}

/** Factory for TradeContext */
export function createTradeContext(params: {
  trade: Trade
  market: TradeContext['market']
  wallet: TradeContext['wallet']
  risk: TradeContext['risk']
  history: TradeContext['history']
  strategy: TradeContext['strategy']
}): TradeContext {
  return { ...params }
}
