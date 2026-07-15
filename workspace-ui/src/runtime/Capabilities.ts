/**
 * Capability System — контроль доступа для Runtime.
 *
 * Виджет объявляет requires: ['market.read', 'market.write'],
 * CapabilityGuard проверяет наличие прав перед рендером.
 */

export type Capability =
  | 'market.read'
  | 'market.write'
  | 'portfolio.read'
  | 'portfolio.write'
  | 'strategy.read'
  | 'strategy.write'
  | 'replay.read'
  | 'replay.write'
  | 'plugin.install'
  | 'plugin.manage'
  | 'eventstore.read'
  | 'eventstore.write'
  | 'ml.read'
  | 'ml.write'
  | 'notification.send'
  | 'admin';

export class CapabilityRegistry {
  private _grants = new Map<string, Set<Capability>>();

  /** Назначить права модулю/пользователю */
  grant(subject: string, ...caps: Capability[]): void {
    if (!this._grants.has(subject)) this._grants.set(subject, new Set());
    for (const cap of caps) this._grants.get(subject)!.add(cap);
  }

  /** Отозвать права */
  revoke(subject: string, ...caps: Capability[]): void {
    const set = this._grants.get(subject);
    if (!set) return;
    for (const cap of caps) set.delete(cap);
  }

  /** Проверить наличие права */
  has(subject: string, cap: Capability): boolean {
    const set = this._grants.get(subject);
    if (!set) return false;
    // admin имеет все права
    if (set.has('admin')) return true;
    return set.has(cap);
  }

  /** Проверить набор прав */
  check(subject: string, required: Capability[]): { ok: boolean; missing: Capability[] } {
    const missing = required.filter(cap => !this.has(subject, cap));
    return { ok: missing.length === 0, missing };
  }

  /** Сбросить все права */
  clear(): void {
    this._grants.clear();
  }
}

// Глобальный реестр прав
export const capabilityRegistry = new CapabilityRegistry();
