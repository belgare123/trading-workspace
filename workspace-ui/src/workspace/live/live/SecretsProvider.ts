/**
 * SecretsProvider.ts — Secure credential storage abstraction
 *
 * Provides a unified interface for resolving broker API credentials
 * without storing them directly in adapter code.
 *
 * Supported backends:
 *  - Environment variables   (via `SECRETS_PROVIDER_<KEY>` or custom prefix)
 *  - In-memory store         (for programmatic / test usage)
 *  - Extensible             (add OS Keychain, Vault, KMS via SecretStore)
 *
 * Resolution order (first wins):
 *   1. Explicit value passed at call site
 *   2. In-memory store
 *   3. Environment variable
 *   4. Default / fallback
 *
 * @since 4.6.4
 */

// ── Secret Store Interface ──

export interface SecretStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  has(key: string): Promise<boolean>
}

// ── Built-in Stores ──

/**
 * Reads secrets from environment variables via the runtime globals.
 *
 * In Vite/Node, this uses import.meta.env (Vite) or process.env (Node).
 * Falls back to an empty lookup if neither is available.
 */

const resolveEnv = (key: string): string | undefined => {
  // Vite exposes env vars via import.meta.env
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env as Record<string, string>)[key] ?? undefined
  }
  // Node / fallback
  try {
    const proc = (globalThis as Record<string, unknown>).process as { env?: Record<string, string> } | undefined
    return proc?.env?.[key]
  } catch {
    return undefined
  }
}

export class EnvSecretStore implements SecretStore {
  private prefix: string

  constructor(prefix = 'SECRETS_PROVIDER_') {
    this.prefix = prefix
  }

  async get(key: string): Promise<string | null> {
    return resolveEnv(`${this.prefix}${key}`) ?? resolveEnv(key) ?? null
  }

  async set(_key: string, _value: string): Promise<void> {
    // Environment variables can't be set at runtime in most platforms
    throw new Error('EnvSecretStore is read-only')
  }

  async delete(_key: string): Promise<void> {
    throw new Error('EnvSecretStore is read-only')
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null
  }
}

/**
 * In-memory secret store. Useful for tests or programmatic setup.
 * NOT persistent — secrets are lost on process restart.
 */
export class MemorySecretStore implements SecretStore {
  private secrets = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.secrets.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.secrets.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.secrets.delete(key)
  }

  async has(key: string): Promise<boolean> {
    return this.secrets.has(key)
  }

  /** Clear all stored secrets */
  clear(): void {
    this.secrets.clear()
  }
}

// ── SecretsProvider ──

export interface SecretsProviderConfig {
  /** Ordered list of stores to resolve from (first wins) */
  stores?: SecretStore[]
  /** Naming convention for broker credentials */
  naming?: 'flat' | 'nested'
}

export const DEFAULT_SECRETS_CONFIG: SecretsProviderConfig = {
  stores: [new EnvSecretStore(), new MemorySecretStore()],
  naming: 'flat',
}

/**
 * Standardised credential keys for broker adapters.
 *
 * Usage:
 *   const apiKey = await secrets.get(SecretKeys.apiKey(brokerId))
 *   const apiSecret = await secrets.get(SecretKeys.apiSecret(brokerId))
 */
export const SecretKeys = {
  apiKey: (brokerId: string): string => `${brokerId}_API_KEY`.toUpperCase(),
  apiSecret: (brokerId: string): string => `${brokerId}_API_SECRET`.toUpperCase(),
  passphrase: (brokerId: string): string => `${brokerId}_PASSPHRASE`.toUpperCase(),
  testnetApiKey: (brokerId: string): string => `${brokerId}_TESTNET_API_KEY`.toUpperCase(),
  testnetApiSecret: (brokerId: string): string => `${brokerId}_TESTNET_API_SECRET`.toUpperCase(),
  /** Custom key */
  custom: (key: string): string => key.toUpperCase(),
}

export class SecretsProvider {
  private stores: SecretStore[]
  private memoryStore: MemorySecretStore

  constructor(config?: SecretsProviderConfig) {
    const cfg = { ...DEFAULT_SECRETS_CONFIG, ...config }

    // Always keep a memory store as the final fallback (and for writes)
    this.memoryStore = new MemorySecretStore()
    this.stores = [...(cfg.stores ?? []), this.memoryStore]
  }

  // ── Resolution ──

  /**
   * Resolve a secret value from the first store that has it.
   * Returns null if not found in any store.
   */
  async get(key: string): Promise<string | null> {
    for (const store of this.stores) {
      try {
        const value = await store.get(key)
        if (value !== null && value !== undefined) {
          return value
        }
      } catch {
        // Store error — try next
      }
    }
    return null
  }

  /**
   * Resolve a secret with a required assertion.
   * Throws SecretNotFound if the key is missing.
   */
  async require(key: string): Promise<string> {
    const value = await this.get(key)
    if (value === null || value === undefined) {
      throw new SecretNotFound(key)
    }
    return value
  }

  /**
   * Convenience: resolve credentials for a broker.
   * Returns { apiKey, apiSecret, passphrase? } or throws.
   */
  async resolveBrokerCredentials(
    brokerId: string,
    testnet?: boolean,
  ): Promise<{ apiKey: string; apiSecret: string; passphrase?: string }> {
    const suffix = testnet ? '_TESTNET' : ''

    const apiKey = await this.require(SecretKeys.apiKey(`${brokerId}${suffix}`))
    const apiSecret = await this.require(SecretKeys.apiSecret(`${brokerId}${suffix}`))
    const passphrase = await this.get(SecretKeys.passphrase(`${brokerId}${suffix}`))

    return { apiKey, apiSecret, passphrase: passphrase ?? undefined }
  }

  // ── Write ──

  /**
   * Store a secret value. Writes to the built-in memory store.
   * For persistence, add a custom store that supports writes.
   */
  async set(key: string, value: string): Promise<void> {
    await this.memoryStore.set(key, value)
  }

  async delete(key: string): Promise<void> {
    await this.memoryStore.delete(key)
  }

  /** Check if a key exists in any store */
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null
  }

  /** Clear all in-memory secrets (does not clear env vars or external stores) */
  clearMemory(): void {
    this.memoryStore.clear()
  }
}

// ── Errors ──

export class SecretNotFound extends Error {
  public readonly key: string

  constructor(key: string) {
    super(`Secret not found: ${key}`)
    this.name = 'SecretNotFound'
    this.key = key
  }
}
