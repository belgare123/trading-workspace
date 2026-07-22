/**
 * RandomSource.ts — Random number generator interface
 *
 * Abstraction over random generation so FailureInjector can use
 * either Math.random() or a deterministic SeededRandom.
 *
 * @since 6.6
 */

export interface RandomSource {
  /** Returns a float in [0, 1) */
  next(): number
  /** Returns an integer in [min, max] inclusive */
  nextInt(min: number, max: number): number
  /** Pick a random element from an array */
  pick<T>(array: readonly T[]): T
  /** Shuffle an array in-place (Fisher-Yates) */
  shuffle<T>(array: T[]): T[]
}
