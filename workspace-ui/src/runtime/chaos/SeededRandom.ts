/**
 * SeededRandom.ts — Deterministic pseudo-random number generator
 *
 * Uses a simple LCG (Linear Congruential Generator) with the
 * same constants as Numerical Recipes (ranqd1).
 * Every scenario using the same seed produces identical results.
 *
 * @since 6.6
 */

import type { RandomSource } from './RandomSource'

export class SeededRandom implements RandomSource {
  private state: number

  constructor(seed: number) {
    this.state = seed | 0
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) | 0
    return (this.state >>> 0) / 0x100000000
  }

  /** Returns an integer in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  /** Pick a random element from an array */
  pick<T>(array: readonly T[]): T {
    return array[Math.floor(this.next() * array.length)]
  }

  /** Shuffle an array in-place (Fisher-Yates) */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }
}
