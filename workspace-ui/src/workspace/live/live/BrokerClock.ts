/**
 * BrokerClock.ts — Exchange-aware clock synchronization
 *
 * Maintains a running offset between local system time and exchange server time.
 * Used to generate timestamps that satisfy exchange recvWindow requirements.
 *
 * Flow:
 *   1. Start with offset = 0 (local time)
 *   2. On first exchange response, record serverTime - localTime as offset
 *   3. Track drift rate; warn when drift exceeds maxDriftMs
 *   4. `now()` returns localTime + offset (synchronized timestamp for API calls)
 *
 * @since 4.6.1
 */

export interface BrokerClockConfig {
  /** Max acceptable drift before warning (default: 5_000) */
  maxDriftMs?: number
  /** Max samples to keep for drift calculation (default: 100) */
  maxSamples?: number
}

interface TimeSample {
  localTime: number
  exchangeTime: number
  offset: number
}

const DEFAULTS: Required<BrokerClockConfig> = {
  maxDriftMs: 5_000,
  maxSamples: 100,
}

export class BrokerClock {
  private config: Required<BrokerClockConfig>
  private _offset = 0
  private samples: TimeSample[] = []
  private _driftRate = 0
  private _warnings: string[] = []

  constructor(config?: BrokerClockConfig) {
    this.config = { ...DEFAULTS, ...config }
  }

  // ── Public API ──

  /** Current synchronized timestamp (localTime + offset) */
  now(): number {
    return Date.now() + this._offset
  }

  /** Update the clock from an exchange response timestamp */
  sync(exchangeTime: number): void {
    const localTime = Date.now()
    const offset = exchangeTime - localTime

    const sample: TimeSample = { localTime, exchangeTime, offset }
    this.samples.push(sample)
    if (this.samples.length > this.config.maxSamples) {
      this.samples.shift()
    }

    // Calculate median offset to filter outliers
    this._offset = this.calculateMedianOffset()
    this._driftRate = this.calculateDriftRate()

    // Check for excessive drift
    const absDrift = Math.abs(this._offset)
    if (absDrift > this.config.maxDriftMs) {
      this._warnings.push(`BrokerClock: drift ${absDrift}ms exceeds max ${this.config.maxDriftMs}ms`)
      if (this._warnings.length > 100) this._warnings.shift()
    }
  }

  /** Current clock offset (exchangeTime - localTime). Positive = exchange is ahead */
  get offset(): number {
    return this._offset
  }

  /** Drift rate in ms/ms (offset change per millisecond since last sync) */
  get driftRate(): number {
    return this._driftRate
  }

  /** Retrieve accumulated warnings */
  get warnings(): readonly string[] {
    return this._warnings
  }

  /** Number of sync samples collected */
  get sampleCount(): number {
    return this.samples.length
  }

  /** Reset clock to local time */
  reset(): void {
    this._offset = 0
    this.samples = []
    this._driftRate = 0
    this._warnings = []
  }

  /** Return a timestamp safe for exchange API calls (with buffer) */
  timestampForExchange(bufferMs = 1_000): number {
    return this.now() - bufferMs
  }

  // ── Private ──

  private calculateMedianOffset(): number {
    if (this.samples.length === 0) return 0
    const offsets = this.samples.map(s => s.offset).sort((a, b) => a - b)
    const mid = Math.floor(offsets.length / 2)
    return offsets.length % 2 === 0
      ? (offsets[mid - 1] + offsets[mid]) / 2
      : offsets[mid]
  }

  private calculateDriftRate(): number {
    if (this.samples.length < 2) return 0
    const oldest = this.samples[0]
    const newest = this.samples[this.samples.length - 1]
    const elapsed = newest.localTime - oldest.localTime
    if (elapsed <= 0) return 0
    return (newest.offset - oldest.offset) / elapsed
  }
}
