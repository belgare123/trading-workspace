
import type { PortfolioRuntime, Position, Balance } from './types';

export class PortfolioService implements PortfolioRuntime {
  readonly id = 'portfolio' as const;

  async positions(): Promise<Position[]> {
    return [
      { pair: 'BTCUSDT', dir: 'long', size: 0.5, entry: 62340, mark: 66210, pnl: 1935, pnlPercent: 6.21 },
      { pair: 'ETHUSDT', dir: 'long', size: 5.0, entry: 3210, mark: 3450, pnl: 1200, pnlPercent: 7.48 },
      { pair: 'SOLUSDT', dir: 'short', size: 20, entry: 152, mark: 143, pnl: 180, pnlPercent: 5.92 },
    ];
  }

  async balance(): Promise<Balance> {
    return { total: 45230, free: 18320, used: 26910, currency: 'USDT' };
  }

  async history(): Promise<Position[]> {
    return this.positions();
  }
}
