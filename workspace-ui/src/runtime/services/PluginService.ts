
import type { PluginRuntime } from './types';

export class PluginService implements PluginRuntime {
  readonly id = 'plugin' as const;
  private _plugins = new Map<string, boolean>([
    ['market-maker', true],
    ['arb-detector', true],
    ['sentiment', false],
  ]);

  async list(): Promise<string[]> { return Array.from(this._plugins.keys()); }
  async enable(id: string): Promise<void> { this._plugins.set(id, true); }
  async disable(id: string): Promise<void> { this._plugins.set(id, false); }
  async install(path: string): Promise<void> { console.log(`[Plugins] Install ${path}`); }
  async uninstall(id: string): Promise<void> { this._plugins.delete(id); }
}
