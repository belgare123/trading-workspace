/**
 * Widget SDK — Public API for internal modules and external plugins.
 *
 * Usage:
 *   import { Workspace } from '../../runtime';
 *
 *   Workspace.registerWidget({
 *     id: 'heatmap',
 *     title: 'Market Heatmap',
 *     category: 'analysis',
 *     defaultSize: { cols: 4, rows: 3 },
 *     render: Heatmap,
 *   });
 */
import { WidgetRegistry } from './WidgetRegistry';
import type { WidgetDefinition, DashboardPreset } from './types';

export const WorkspaceSDK = {
  // ── Widget Registry ──
  registerWidget(def: WidgetDefinition): void {
    WidgetRegistry.register(def);
  },

  unregisterWidget(id: string): boolean {
    return WidgetRegistry.unregister(id);
  },

  getWidget(id: string) {
    return WidgetRegistry.get(id);
  },

  getAllWidgets() {
    return WidgetRegistry.getAll();
  },

  getWidgetCategories() {
    return WidgetRegistry.categories();
  },

  // ── Presets (pass-through for now) ──
  presets: {
    apply(preset: DashboardPreset) {
      // Future: persistent layout state
      console.log('[WorkspaceSDK] Applying preset:', preset.id);
      return preset;
    },
  },

  // ── Version ──
  version: '2.0.0',

  /** Metadata for dev tools */
  metadata() {
    return {
      widgets: WidgetRegistry.metadata(),
    };
  },
};

// Convenience alias
export const Workspace = WorkspaceSDK;
