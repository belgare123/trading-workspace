/**
 * PluginSandbox — базовая изоляция для плагинов.
 *
 * Уровни изоляции:
 * - none: прямая регистрация (текущее поведение)
 * - worker: Web Worker (асинхронный, нет DOM)
 * - iframe: изолированный iframe (полная DOM-изоляция)
 *
 * TODO:
 * - Worker sandbox (требует компиляции в отдельный бандл)
 * - iframe sandbox (требует postMessage-моста)
 * - RPC-протокол между Runtime и Sandbox
 */

export type SandboxLevel = 'none' | 'worker' | 'iframe';

export interface SandboxConfig {
  level: SandboxLevel;
  /** Разрешённые API для sandbox */
  allowedApis?: string[];
  /** Таймаут инициализации (мс) */
  timeout?: number;
  /** Размер памяти (для Worker) */
  memoryLimit?: number;
}

const DEFAULT_CONFIG: SandboxConfig = {
  level: 'none',
  allowedApis: ['market', 'portfolio', 'replay'],
  timeout: 5000,
};

/**
 * SandboxPolicy — определяет, можно ли загрузить плагин с данным уровнем изоляции.
 */
export class SandboxPolicy {
  private _maxLevel: SandboxLevel = 'none';

  /** Установить максимальный уровень изоляции */
  setMaxLevel(level: SandboxLevel): void {
    this._maxLevel = level;
  }

  /** Проверить, разрешён ли уровень */
  allows(level: SandboxLevel): boolean {
    const levels: SandboxLevel[] = ['none', 'worker', 'iframe'];
    return levels.indexOf(level) <= levels.indexOf(this._maxLevel);
  }

  /** Получить конфигурацию для плагина */
  getConfig(level?: SandboxLevel): SandboxConfig {
    const requested = level ?? 'none';
    if (!this.allows(requested)) {
      console.warn(`[Sandbox] Level '${requested}' not allowed, falling back to '${this._maxLevel}'`);
      return { ...DEFAULT_CONFIG, level: this._maxLevel };
    }
    return { ...DEFAULT_CONFIG, level: requested };
  }
}

export const sandboxPolicy = new SandboxPolicy();
