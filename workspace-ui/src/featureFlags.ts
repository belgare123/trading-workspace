import { useState, useEffect } from 'react'

/**
 * Feature Flags — typed toggles for workspace capabilities.
 *
 * All flags default to `true` (enabled).
 * Override via localStorage key `tw:flags` as JSON:
 *   localStorage.setItem('tw:flags', JSON.stringify({ 'workspace.search': false }))
 *
 * Flags are read once at init and cached; a full page reload is required
 * for changes to take effect. For dynamic overrides, reset the cache:
 *   import { featureFlags } from './featureFlags'
 *   featureFlags.reset()
 */

export type FeatureFlag =
  | 'workspace.commandPalette'
  | 'workspace.search'
  | 'workspace.timeline'
  | 'workspace.ml'
  | 'workspace.marketplace'
  | 'workspace.plugins'
  | 'workspace.replay'
  | 'workspace.hotkeys'
  | 'workspace.animations'
  | 'workspace.telemetry'

type Overrides = Partial<Record<FeatureFlag, boolean>>

const STORAGE_KEY = 'tw:flags'

const DEFAULTS: Record<FeatureFlag, boolean> = {
  'workspace.commandPalette': true,
  'workspace.search': true,
  'workspace.timeline': true,
  'workspace.ml': true,
  'workspace.marketplace': true,
  'workspace.plugins': true,
  'workspace.replay': true,
  'workspace.hotkeys': true,
  'workspace.animations': true,
  'workspace.telemetry': true,
}

// ── FeatureFlagRegistry (singleton) ─────────────────────────────────

class FeatureFlagRegistryImpl {
  private cache: Record<FeatureFlag, boolean> | null = null

  /** Get all flags (cached after first read). */
  getAll(): Record<FeatureFlag, boolean> {
    if (!this.cache) this.cache = this.load()
    return { ...this.cache }
  }

  /** Check if a single flag is enabled. */
  isEnabled(flag: FeatureFlag): boolean {
    return this.getAll()[flag] ?? true
  }

  /** Override flags at runtime (cached layer). */
  override(overrides: Overrides): void {
    this.cache = { ...this.getAll(), ...this.sanitize(overrides) }
    this.persist()
  }

  /** Reset cache and reload from localStorage. */
  reset(): void {
    this.cache = null
  }

  /** Clear all overrides and reset to defaults. */
  clearOverrides(): void {
    localStorage.removeItem(STORAGE_KEY)
    this.reset()
  }

  // ── Internal ──────────────────────────────────────────────────────

  private load(): Record<FeatureFlag, boolean> {
    const flags = { ...DEFAULTS }
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed: Overrides = JSON.parse(raw)
        Object.assign(flags, this.sanitize(parsed))
      }
    } catch {
      // Ignore corrupt localStorage
    }
    return flags
  }

  private persist(): void {
    const overrides: Overrides = {}
    for (const key of Object.keys(DEFAULTS) as FeatureFlag[]) {
      const val = this.cache?.[key]
      if (val !== undefined && val !== DEFAULTS[key]) {
        overrides[key] = val
      }
    }
    const json = JSON.stringify(overrides)
    if (json === '{}') {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, json)
    }
  }

  private sanitize(overrides: Overrides): Overrides {
    const clean: Overrides = {}
    for (const [key, val] of Object.entries(overrides)) {
      if (key in DEFAULTS && typeof val === 'boolean') {
        clean[key as FeatureFlag] = val
      }
    }
    return clean
  }
}

export const featureFlags = new FeatureFlagRegistryImpl()

// ── React hooks ─────────────────────────────────────────────────────

export function useFeatureFlag(flag: FeatureFlag): boolean {
  const [enabled, setEnabled] = useState(() => featureFlags.isEnabled(flag))

  useEffect(() => {
    setEnabled(featureFlags.isEnabled(flag))
  }, [flag])

  return enabled
}

export function useFeatureFlags(): Record<FeatureFlag, boolean> {
  const [flags, setFlags] = useState(() => featureFlags.getAll())

  useEffect(() => {
    setFlags(featureFlags.getAll())
  }, [])

  return flags
}
