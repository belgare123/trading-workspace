import { WidgetRegistry } from './WidgetRegistry';
import { capabilityRegistry, type Capability } from './Capabilities';
import { Container } from './Container';
import { runtimeEventBus } from './EventBus';
import { validateManifest, type Manifest } from './Manifest';
import { resolveDependencies, type VersionManifest } from './VersionResolver';
import { sandboxPolicy, type SandboxLevel } from './PluginSandbox';
import { RT } from './RuntimeEvents';

// ── Lifecycle States ──
export type PluginState =
  | 'installed'
  | 'validated'
  | 'loaded'
  | 'activated'
  | 'ready'
  | 'sleeping'
  | 'deactivated'
  | 'unloaded'
  | 'removed'
  | 'error';

const VALID_TRANSITIONS: Record<PluginState, PluginState[]> = {
  installed:   ['validated', 'removed', 'error'],
  validated:   ['loaded', 'deactivated', 'removed', 'error'],
  loaded:      ['activated', 'sleeping', 'deactivated', 'error'],
  activated:   ['ready', 'sleeping', 'deactivated', 'error'],
  ready:       ['sleeping', 'deactivated', 'error'],
  sleeping:    ['ready', 'deactivated', 'error'],
  deactivated: ['loaded', 'unloaded', 'removed', 'error'],
  unloaded:    ['installed', 'removed', 'error'],
  removed:     [],
  error:       ['installed', 'deactivated', 'error'],
};

export interface PluginPackage {
  manifest: Manifest;
  sandbox?: SandboxLevel;
  /** Провайдер регистрации */
  register?: (ctx: PluginContext) => void;
  /** Очистка при выгрузке */
  unregister?: () => void;
}

export interface PluginContext {
  widgets: typeof WidgetRegistry;
  events: typeof runtimeEventBus;
  container: Container;
  capabilities: typeof capabilityRegistry;
}

interface PluginRecord {
  pkg: PluginPackage;
  state: PluginState;
  context: PluginContext;
}

const _plugins = new Map<string, PluginRecord>();

function _transition(id: string, to: PluginState): { ok: boolean; error?: string } {
  const record = _plugins.get(id);
  if (!record) return { ok: false, error: `Plugin '${id}' not found` };

  const allowed = VALID_TRANSITIONS[record.state];
  if (!allowed.includes(to)) {
    return { ok: false, error: `Cannot transition '${id}' from ${record.state} to ${to}` };
  }

  record.state = to;

  // Эмит стандартного события
  const eventMap: Record<string, string> = {
    installed: RT.plugin.installed,
    validated: RT.plugin.validated,
    loaded: RT.plugin.loaded,
    activated: RT.plugin.activated,
    ready: RT.plugin.ready,
    sleeping: RT.plugin.sleeping,
    deactivated: RT.plugin.deactivated,
    unloaded: RT.plugin.unloaded,
    removed: RT.plugin.removed,
  };
  const evt = eventMap[to];
  if (evt) runtimeEventBus.emit(evt, { id, state: to }, { source: 'PluginLoader' });

  return { ok: true };
}

function _defaultContext(container?: Container): PluginContext {
  return {
    widgets: WidgetRegistry,
    events: runtimeEventBus,
    container: container ?? new Container(),
    capabilities: capabilityRegistry,
  };
}

/**
 * PluginLoader v2 — полноценный жизненный цикл плагинов.
 *
 * install() → validate() → load() → activate() → ready()
 *                                          → sleep() → resume()
 *                        → deactivate() → unload() → remove()
 */
export const PluginLoader = {
  /** 1. Install — установить манифест */
  install(pkg: PluginPackage, context?: Container): { ok: boolean; error?: string } {
    if (_plugins.has(pkg.manifest.id)) {
      return { ok: false, error: `Plugin '${pkg.manifest.id}' already installed` };
    }

    const ctx = _defaultContext(context);
    _plugins.set(pkg.manifest.id, { pkg, state: 'installed', context: ctx });
    runtimeEventBus.emit(RT.plugin.installed, { id: pkg.manifest.id, version: pkg.manifest.version }, { source: 'PluginLoader' });
    return { ok: true };
  },

  /** 2. Validate — проверить манифест + права + зависимости */
  validate(id: string, available?: Map<string, string>): { ok: boolean; error?: string; warnings?: string[] } {
    const record = _plugins.get(id);
    if (!record) return { ok: false, error: `Plugin '${id}' not found` };

    const t = _transition(id, 'validated');
    if (!t.ok) return t;

    // Валидация манифеста
    const validation = validateManifest(record.pkg.manifest);
    if (!validation.valid) {
      _transition(id, 'error');
      return { ok: false, error: `Validation failed: ${validation.errors.join(', ')}` };
    }

    // Проверка прав
    const requiredCaps: Capability[] = record.pkg.manifest.permissions ?? [];
    if (requiredCaps.length > 0) {
      const check = record.context.capabilities.check('plugin-loader', requiredCaps);
      if (!check.ok) {
        _transition(id, 'error');
        runtimeEventBus.emit(RT.plugin.blocked, { id, missing: check.missing }, { source: 'PluginLoader', severity: 'warn' });
        return { ok: false, error: `Missing capabilities: ${check.missing.join(', ')}` };
      }
    }

    // Разрешение зависимостей
    if (available && record.pkg.manifest.dependencies) {
      const vmanifest: VersionManifest = {
        id: record.pkg.manifest.id,
        version: record.pkg.manifest.version,
        dependencies: record.pkg.manifest.dependencies,
      };
      const deps = resolveDependencies(vmanifest, available);
      if (!deps.ok) {
        _transition(id, 'error');
        return { ok: false, error: `Dependency resolution failed: ${deps.errors.join(', ')}` };
      }
    }

    // Проверка sandbox
    const sbLevel = record.pkg.sandbox ?? 'none';
    if (!sandboxPolicy.allows(sbLevel)) {
      _transition(id, 'error');
      return { ok: false, error: `Sandbox level '${sbLevel}' not allowed` };
    }

    return { ok: true };
  },

  /** 3. Load — выполнить register() */
  load(id: string): { ok: boolean; error?: string } {
    const record = _plugins.get(id);
    if (!record) return { ok: false, error: `Plugin '${id}' not found` };

    const t = _transition(id, 'loaded');
    if (!t.ok) return t;

    try {
      record.pkg.register?.(record.context);
      return { ok: true };
    } catch (err) {
      _transition(id, 'error');
      runtimeEventBus.emit(RT.plugin.failed, { id, error: String(err) }, { source: 'PluginLoader', severity: 'error' });
      return { ok: false, error: `Load failed: ${err}` };
    }
  },

  /** 4. Activate — включить плагин */
  activate(id: string): { ok: boolean; error?: string } {
    return _transition(id, 'activated');
  },

  /** 5. Ready — плагин готов к работе */
  ready(id: string): { ok: boolean; error?: string } {
    return _transition(id, 'ready');
  },

  /** 6. Sleep — временно отключить */
  sleep(id: string): { ok: boolean; error?: string } {
    return _transition(id, 'sleeping');
  },

  /** 7. Resume — возобновить */
  resume(id: string): { ok: boolean; error?: string } {
    return _transition(id, 'ready');
  },

  /** 8. Deactivate — деактивировать */
  deactivate(id: string): { ok: boolean; error?: string } {
    return _transition(id, 'deactivated');
  },

  /** 9. Unload — выгрузить (вызов unregister) */
  unload(id: string): { ok: boolean; error?: string } {
    const record = _plugins.get(id);
    if (!record) return { ok: false, error: `Plugin '${id}' not found` };

    const t = _transition(id, 'unloaded');
    if (!t.ok) return t;

    try {
      record.pkg.unregister?.();
      return { ok: true };
    } catch (err) {
      console.error(`[PluginLoader] Error unloading '${id}':`, err);
      return { ok: false, error: String(err) };
    }
  },

  /** 10. Remove — полностью удалить */
  remove(id: string): { ok: boolean; error?: string } {
    const t = _transition(id, 'removed');
    if (!t.ok) return t;
    _plugins.delete(id);
    return { ok: true };
  },

  // ── Shortcuts ──

  /** Install → Validate → Load → Activate → Ready за один шаг */
  loadAndActivate(pkg: PluginPackage, context?: Container, available?: Map<string, string>): { ok: boolean; error?: string } {
    const install = this.install(pkg, context);
    if (!install.ok) return install;

    const validate = this.validate(pkg.manifest.id, available);
    if (!validate.ok) return validate;

    const load = this.load(pkg.manifest.id);
    if (!load.ok) return load;

    const activate = this.activate(pkg.manifest.id);
    if (!activate.ok) return activate;

    return this.ready(pkg.manifest.id);
  },

  /** Deactivate → Unload → Remove */
  unloadAndRemove(id: string): { ok: boolean; error?: string } {
    const deact = this.deactivate(id);
    if (!deact.ok) return deact;

    const unload = this.unload(id);
    if (!unload.ok) return unload;

    return this.remove(id);
  },

  // ── Queries ──
  state(id: string): PluginState | undefined {
    return _plugins.get(id)?.state;
  },

  loaded(): Manifest[] {
    return Array.from(_plugins.values())
      .filter(r => r.state === 'ready' || r.state === 'activated')
      .map(r => r.pkg.manifest);
  },

  isLoaded(id: string): boolean {
    const s = _plugins.get(id)?.state;
    return s === 'ready' || s === 'activated';
  },

  all(): { id: string; state: PluginState; version: string }[] {
    return Array.from(_plugins.entries()).map(([id, r]) => ({
      id,
      state: r.state,
      version: r.pkg.manifest.version,
    }));
  },
};
