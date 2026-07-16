// ── IndicatorContext — доступ к индикаторам для стратегии ──
//
// Стратегия получает значения индикаторов через ctx.indicators:
//   ctx.indicators.sma(20)
//   ctx.indicators.ema(20)
//   ctx.indicators.rsi(14)
//   ctx.indicators.macd()
//
// Абстрагирует стратегию от источника данных —
// реализация может брать данные из Chart Studio, backend или локального расчёта.
//
// @since 3.4.2

export interface MACDResult {
  macd: number
  signal: number
  histogram: number
}

export interface BollingerResult {
  upper: number
  middle: number
  lower: number
}

export interface IndicatorContext {
  /** Simple Moving Average */
  sma(period: number, symbol?: string, timeframe?: string): Promise<number>

  /** Exponential Moving Average */
  ema(period: number, symbol?: string, timeframe?: string): Promise<number>

  /** Relative Strength Index */
  rsi(period: number, symbol?: string, timeframe?: string): Promise<number>

  /** MACD */
  macd(symbol?: string, timeframe?: string): Promise<MACDResult>

  /** Bollinger Bands */
  bollinger(period: number, stdDev?: number, symbol?: string, timeframe?: string): Promise<BollingerResult>

  /** Average True Range */
  atr(period: number, symbol?: string, timeframe?: string): Promise<number>

  /** Volume */
  volume(symbol?: string, timeframe?: string): Promise<number>

  /** Получить историю значений индикатора */
  history(name: string, period: number, limit?: number, symbol?: string, timeframe?: string): Promise<number[]>
}
