import type { SpeedPreset } from '../types'

export class PlaybackSpeed {
  static readonly values: SpeedPreset[] = [1, 2, 5, 10, 50, 100, 1000, 'max']

  /** Get delay between bar ticks in ms for a given speed */
  static delay(speed: SpeedPreset): number {
    if (speed === 'max') return 0
    return 1000 / speed
  }

  /** Validate speed value */
  static isValid(speed: unknown): boolean {
    return speed === 'max' || (typeof speed === 'number' && [1, 2, 5, 10, 50, 100, 1000].includes(speed))
  }

  /** Human-readable label */
  static label(speed: SpeedPreset): string {
    if (speed === 'max') return 'Max'
    return `${speed}×`
  }

  /** Next slower speed */
  static slower(current: SpeedPreset): SpeedPreset {
    const idx = this.values.indexOf(current)
    if (idx <= 0) return current
    return this.values[idx - 1]
  }

  /** Next faster speed */
  static faster(current: SpeedPreset): SpeedPreset {
    const idx = this.values.indexOf(current)
    if (idx >= this.values.length - 1) return current
    return this.values[idx + 1]
  }
}
