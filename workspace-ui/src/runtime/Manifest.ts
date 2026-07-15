import type { Capability } from './Capabilities';

/**
 * Manifest — единый формат пакета для Marketplace.
 *
 * Любой пакет содержит manifest.json с описанием
 * виджетов, команд, поисковых элементов и прав.
 *
 * Пример:
 * {
 *   "id": "orderflow",
 *   "name": "Order Flow Suite",
 *   "version": "1.0.0",
 *   "description": "Professional order flow tools",
 *   "widgets": ["orderflow", "footprint", "liquidity-map"],
 *   "commands": ["orderflow.open"],
 *   "search": ["orderflow"],
 *   "permissions": ["market.read"],
 *   "dependencies": {},
 *   "entry": "./index.ts"
 * }
 */
export interface Manifest {
  /** Уникальный ID пакета */
  id: string;
  /** Человеческое название */
  name: string;
  /** Семантическая версия */
  version: string;
  /** Описание */
  description?: string;
  /** Автор */
  author?: string;
  /** Регистрируемые виджеты (по ID) */
  widgets?: string[];
  /** Регистрируемые команды */
  commands?: string[];
  /** Регистрируемые поисковые элементы */
  search?: string[];
  /** Требуемые права */
  permissions?: Capability[];
  /** Зависимости от других пакетов */
  dependencies?: Record<string, string>;
  /** Точка входа (относительный путь) */
  entry?: string;
  /** Иконка (имя lucide-иконки или URL) */
  icon?: string;
}

export interface ManifestValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Валидатор манифеста
 */
export function validateManifest(m: unknown): ManifestValidation {
  const errors: string[] = [];
  if (!m || typeof m !== 'object') return { valid: false, errors: ['Manifest must be an object'] };

  const manifest = m as Record<string, unknown>;

  if (!manifest.id || typeof manifest.id !== 'string') errors.push('Missing or invalid "id"');
  if (!manifest.name || typeof manifest.name !== 'string') errors.push('Missing or invalid "name"');
  if (!manifest.version || typeof manifest.version !== 'string') errors.push('Missing or invalid "version"');
  if (manifest.widgets && !Array.isArray(manifest.widgets)) errors.push('"widgets" must be an array');
  if (manifest.commands && !Array.isArray(manifest.commands)) errors.push('"commands" must be an array');
  if (manifest.permissions && !Array.isArray(manifest.permissions)) errors.push('"permissions" must be an array');

  return { valid: errors.length === 0, errors };
}
