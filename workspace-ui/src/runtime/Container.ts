import type { RuntimeServices } from './services/types';

/**
 * Container — Dependency Injection для Runtime.
 *
 * Виджет объявляет dependencies: ['market', 'portfolio', 'replay'],
 * Container предоставляет их через get().
 */
export class Container {
  private _services = new Map<string, unknown>();
  private _factory = new Map<string, () => unknown>();

  /** Зарегистрировать сервис */
  register<T>(name: string, instance: T): void {
    this._services.set(name, instance);
  }

  /** Зарегистрировать фабрику (lazy) */
  registerFactory<T>(name: string, factory: () => T): void {
    this._factory.set(name, factory);
  }

  /** Получить сервис по имени */
  get<T = unknown>(name: string): T {
    if (this._services.has(name)) return this._services.get(name) as T;
    if (this._factory.has(name)) {
      const instance = this._factory.get(name)!() as T;
      this._services.set(name, instance);
      return instance;
    }
    throw new Error(`[Container] Service not found: '${name}'`);
  }

  /** Проверить наличие сервиса */
  has(name: string): boolean {
    return this._services.has(name) || this._factory.has(name);
  }

  /** Получить несколько сервисов по списку имён */
  resolve(names: string[]): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const name of names) {
      resolved[name] = this.get(name);
    }
    return resolved;
  }

  /** Получить RuntimeServices-совместимый объект */
  getRuntimeServices(): RuntimeServices {
    return {
      market: this.get('market'),
      replay: this.get('replay'),
      plugin: this.get('plugin'),
      portfolio: this.get('portfolio'),
      strategy: this.get('strategy'),
      ml: this.get('ml'),
      notification: this.get('notification'),
      search: this.get('search'),
      eventStore: this.get('eventStore'),
    };
  }
}
