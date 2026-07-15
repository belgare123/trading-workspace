
import type { StrategyRuntime, StrategyInfo, StrategyMetrics } from './types';

export class StrategyService implements StrategyRuntime {
  readonly id = 'strategy' as const;

  async list(): Promise<StrategyInfo[]> {
    return [
      { id: 'momentum', name: 'Momentum V4', status: 'active', pair: 'BTCUSDT', pnl24h: 1.2 },
      { id: 'grid', name: 'Grid Bot', status: 'active', pair: 'ETHUSDT', pnl24h: 0.8 },
      { id: 'arb', name: 'Arbitrage', status: 'paused', pair: 'SOLUSDT', pnl24h: 0.0 },
    ];
  }

  async enable(id: string): Promise<void> { console.log(`[Strategy] Enable ${id}`); }
  async disable(id: string): Promise<void> { console.log(`[Strategy] Disable ${id}`); }

  async metrics(_id: string): Promise<StrategyMetrics> {
    return { sharpe: 2.14, winRate: 67.3, totalTrades: 842, avgProfit: 1.8, maxDrawdown: 8.5 };
  }
}
