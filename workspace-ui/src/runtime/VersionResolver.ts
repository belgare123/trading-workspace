/**
 * VersionResolver — разрешение зависимостей плагинов.
 *
 * Поддерживает:
 * - dependencies (обязательные)
 * - peerDependencies (одного уровня)
 * - optionalDependencies (необязательные)
 * - conflicts (конфликтующие)
 *
 * Синтаксис версий: "^1.2.3", "~1.2.0", ">=2.0.0", "1.x", "*"
 */

export interface VersionManifest {
  id: string;
  version: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  conflicts?: Record<string, string>;
}

export interface ResolveResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  resolved: Map<string, string>;
}

/** Разобрать semver-строку */
function parseSemver(v: string): { major: number; minor: number; patch: number } | null {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return { major: parseInt(m[1]), minor: parseInt(m[2]), patch: parseInt(m[3]) };
}

/** Проверить, соответствует ли версия диапазону */
function satisfies(version: string, range: string): boolean {
  if (range === '*' || range === 'x') return true;

  const v = parseSemver(version);
  if (!v) return false;

  // Exact match
  if (range === version) return true;

  // ^1.2.3 — совместимость до следующей major
  const caret = range.match(/^\^(\d+)\.(\d+)\.(\d+)/);
  if (caret) {
    const r = { major: parseInt(caret[1]), minor: parseInt(caret[2]), patch: parseInt(caret[3]) };
    if (v.major !== r.major) return false;
    if (v.minor < r.minor) return false;
    if (v.minor === r.minor && v.patch < r.patch) return false;
    return true;
  }

  // ~1.2.0 — примерно равно (minor фиксирован)
  const tilde = range.match(/^~(\d+)\.(\d+)\.(\d+)/);
  if (tilde) {
    const r = { major: parseInt(tilde[1]), minor: parseInt(tilde[2]), patch: parseInt(tilde[3]) };
    if (v.major !== r.major) return false;
    if (v.minor !== r.minor) return false;
    if (v.patch < r.patch) return false;
    return true;
  }

  // >=1.2.3
  const gte = range.match(/^>=(\d+)\.(\d+)\.(\d+)/);
  if (gte) {
    const r = { major: parseInt(gte[1]), minor: parseInt(gte[2]), patch: parseInt(gte[3]) };
    if (v.major < r.major) return false;
    if (v.major === r.major && v.minor < r.minor) return false;
    if (v.major === r.major && v.minor === r.minor && v.patch < r.patch) return false;
    return true;
  }

  // 1.x — любая в рамках major
  const majorX = range.match(/^(\d+)\.x/);
  if (majorX) {
    return v.major === parseInt(majorX[1]);
  }

  return false;
}

/**
 * Разрешить зависимости для плагина.
 * @param plugin — манифест разрешаемого плагина
 * @param available — карта доступных плагинов { id => version }
 */
export function resolveDependencies(
  plugin: VersionManifest,
  available: Map<string, string>
): ResolveResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const resolved = new Map<string, string>();

  const allDeps: { type: string; deps: Record<string, string> | undefined }[] = [
    { type: 'dependencies', deps: plugin.dependencies },
    { type: 'peerDependencies', deps: plugin.peerDependencies },
  ];

  for (const { type, deps } of allDeps) {
    if (!deps) continue;
    for (const [depId, depRange] of Object.entries(deps)) {
      const installed = available.get(depId);
      if (!installed) {
        errors.push(`Missing ${type} '${depId}' (required: ${depRange})`);
        continue;
      }
      if (!satisfies(installed, depRange)) {
        errors.push(`'${depId}' version ${installed} does not satisfy ${type} range ${depRange}`);
        continue;
      }
      resolved.set(depId, installed);
    }
  }

  // Optional dependencies — только предупреждения
  if (plugin.optionalDependencies) {
    for (const [depId, depRange] of Object.entries(plugin.optionalDependencies)) {
      const installed = available.get(depId);
      if (!installed) {
        warnings.push(`Optional dependency '${depId}' not installed`);
      } else if (!satisfies(installed, depRange)) {
        warnings.push(`Optional '${depId}' version ${installed} outside range ${depRange}`);
      } else {
        resolved.set(depId, installed);
      }
    }
  }

  // Conflicts
  if (plugin.conflicts) {
    for (const [conflictId, conflictRange] of Object.entries(plugin.conflicts)) {
      const installed = available.get(conflictId);
      if (installed && satisfies(installed, conflictRange)) {
        errors.push(`Conflict: '${plugin.id}' conflicts with '${conflictId}' ${installed}`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings, resolved };
}
