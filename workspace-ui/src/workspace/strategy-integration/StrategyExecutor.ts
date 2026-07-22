// ── StrategyExecutor — bridge StrategyRuntime → TradeLifecycleRuntime ──
// Sprint 5.7 — StrategyRuntime Integration

import type { TradeLifecycleRuntime } from '../trade/runtime/TradeLifecycleRuntime'
import type { StrategyIntegrationConfig } from './types'
import { mapStrategySignal } from './types'
import type { StrategySignal } from '../strategy/types'
import type { IWalletManager } from '../wallet/types'

/**
 * StrategyExecutor — единственный мост между StrategyRuntime и TradeLifecycleRuntime.
 *
 * Pipeline: StrategySignal → WalletManager.allocate() → TradeSignal → TradeLifecycleRuntime.open()
 *
 * Responsibilities:
 * - Map StrategySignal → TradeSignal
 * - Call WalletManager.allocate() for position sizing
 * - Call TradeLifecycleRuntime.open() with computed quantity
 * - Apply default SL/TP if strategy didn't provide
 * - Handle close signals by calling requestClose on open trade
 */
export class StrategyExecutor {
  private readonly _runtime: TradeLifecycleRuntime
  private readonly _wallet: IWalletManager
  private readonly _config: StrategyIntegrationConfig

  constructor(
    runtime: TradeLifecycleRuntime,
    wallet: IWalletManager,
    config?: Partial<StrategyIntegrationConfig>,
  ) {
    this._runtime = runtime
    this._wallet = wallet
    this._config = {
      defaultStopLossPct: config?.defaultStopLossPct ?? -0.02,
      defaultTakeProfitPct: config?.defaultTakeProfitPct ?? 0.03,
      minConfidence: config?.minConfidence ?? 0,
      enablePositionGuard: config?.enablePositionGuard ?? true,
    }
  }

  get config(): Readonly<StrategyIntegrationConfig> {
    return this._config
  }

  /**
   * Execute a strategy signal.
   * Returns true if a trade was opened, false if rejected.
   */
  async execute(
    strategyId: string,
    signal: StrategySignal,
    currentPrice: number,
  ): Promise<boolean> {
    // Close signal — find and close the open trade for this symbol
    if (signal.direction === 'close') {
      await this._handleClose(signal)
      return true
    }

    // Validate confidence
    if (this._config.minConfidence > 0 && (signal.confidence ?? 0) < this._config.minConfidence) {
      return false
    }

    // Extract SL/TP from signal meta or use defaults
    const stopLoss = signal.meta?.stopLoss as number
      ?? (currentPrice * (1 + this._config.defaultStopLossPct))
    const takeProfit = signal.meta?.takeProfit as number
      ?? (currentPrice * (1 + this._config.defaultTakeProfitPct))

    // Get position size from WalletManager
    const allocation = this._wallet.allocate({
      strategyId,
      symbol: signal.symbol,
      direction: signal.direction === 'buy' ? 'long' : 'short',
      price: currentPrice,
      stopLoss,
    })
    if (allocation.quantity <= 0) {
      return false
    }

    // Open trade via TradeLifecycleRuntime
    try {
      await this._runtime.open({
        strategyId,
        symbol: signal.symbol,
        direction: signal.direction === 'buy' ? 'long' : 'short',
        price: signal.price ?? currentPrice,
        stopLoss,
        takeProfit,
        type: 'market',
        quantity: allocation.quantity,
        metadata: { ...signal.meta, allocationMethod: allocation.method },
      })
      return true
    } catch {
      return false
    }
  }

  private async _handleClose(signal: StrategySignal): Promise<void> {
    const trades = this._runtime.getActiveTrades()
    const trade = trades.find(t => t.symbol === signal.symbol)
    if (trade) {
      await this._runtime.requestClose(trade.id, signal.meta?.reason as string ?? 'signal-close')
    }
  }
}
