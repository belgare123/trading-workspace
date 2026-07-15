'use client';

import { useMemo } from 'react';
import { WidgetRegistry } from './WidgetRegistry';
import { useLayoutEngine } from './LayoutEngine';
import { registerDefaultWidgets } from './registerDefaultWidgets';
import type { DashboardPreset, WidgetInstance, WidgetPlacement } from './types';

let registered = false;
function ensureWidgets() {
  if (!registered) {
    registerDefaultWidgets();
    registered = true;
  }
}

/**
 * useWidgetLayout — single hook that:
 * 1. Ensures all default widgets are registered
 * 2. Loads a preset and creates WidgetInstance[]
 * 3. Returns the LayoutEngine state + actions
 *
 * Usage:
 *   const { state, actions, visible, fullscreen } = useWidgetLayout('default');
 */
export function useWidgetLayout(presetId: string = 'default') {
  ensureWidgets();

  const preset = useMemo(() => getPresetById(presetId), [presetId]);

  const initialInstances = useMemo(() => {
    if (!preset) return [];
    let idCounter = 0;
    return preset.widgets.map((p: WidgetPlacement): WidgetInstance => {
      idCounter++;
      const def = WidgetRegistry.get(p.widget);
      return {
        instanceId: `${p.widget}-${idCounter}`,
        definitionId: p.widget,
        x: p.x,
        y: p.y,
        size: def ? { cols: p.w, rows: p.h } : { cols: 2, rows: 2 },
        settings: p.settings ?? {},
        pinned: false,
        collapsed: false,
      };
    });
  }, [preset]);

  const { state, actions, fullscreen, visible } = useLayoutEngine(initialInstances);

  return {
    preset,
    state,
    actions,
    fullscreen,
    visible,
    columns: parseColumns(preset?.columns ?? '1fr'),
  };
}

function parseColumns(cols: string): number {
  return cols.split(/\s+/).length;
}

function getPresetById(id: string): DashboardPreset | undefined {
  const presets: DashboardPreset[] = [
    {
      id: 'default',
      title: 'Overview',
      columns: '320px 1fr 420px',
      widgets: [
        { widget: 'metrics', x: 0, y: 0, w: 3, h: 1 },
        { widget: 'signals', x: 0, y: 1, w: 1, h: 3 },
        { widget: 'event-flow', x: 1, y: 1, w: 1, h: 3 },
        { widget: 'portfolio', x: 2, y: 1, w: 1, h: 2 },
        { widget: 'strategies', x: 0, y: 4, w: 1, h: 2 },
        { widget: 'timeline', x: 1, y: 4, w: 1, h: 2 },
        { widget: 'health', x: 2, y: 3, w: 1, h: 1 },
        { widget: 'replay', x: 0, y: 6, w: 2, h: 1 },
        { widget: 'opportunities', x: 2, y: 4, w: 1, h: 1 },
        { widget: 'workspace-status', x: 0, y: 7, w: 3, h: 1 },
      ],
    },
    {
      id: 'signals-focus',
      title: 'Signals Focus',
      columns: '1fr 360px',
      widgets: [
        { widget: 'metrics', x: 0, y: 0, w: 2, h: 1 },
        { widget: 'signals', x: 1, y: 1, w: 1, h: 4 },
        { widget: 'event-flow', x: 0, y: 1, w: 1, h: 2 },
        { widget: 'portfolio', x: 0, y: 3, w: 1, h: 1 },
        { widget: 'strategies', x: 0, y: 4, w: 1, h: 1 },
        { widget: 'timeline', x: 0, y: 5, w: 1, h: 1 },
        { widget: 'health', x: 0, y: 6, w: 1, h: 1 },
      ],
    },
    {
      id: 'monitoring',
      title: 'Monitoring',
      columns: '1fr 1fr 1fr',
      widgets: [
        { widget: 'metrics', x: 0, y: 0, w: 3, h: 1 },
        { widget: 'health', x: 0, y: 1, w: 1, h: 2 },
        { widget: 'timeline', x: 1, y: 1, w: 1, h: 2 },
        { widget: 'workspace-status', x: 2, y: 1, w: 1, h: 2 },
        { widget: 'replay', x: 0, y: 3, w: 3, h: 1 },
        { widget: 'event-flow', x: 0, y: 4, w: 3, h: 2 },
      ],
    },
  ];
  return presets.find(p => p.id === id);
}
