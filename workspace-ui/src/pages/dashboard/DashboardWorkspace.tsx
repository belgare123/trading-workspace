'use client';

import { useWidgetLayout, RuntimeProvider, LayoutRenderer } from '../../runtime';

interface DashboardWorkspaceProps {
  preset?: string;
}

/**
 * DashboardWorkspace — the runtime-powered dashboard.
 * Uses WidgetRegistry + LayoutEngine + PanelRenderer.
 * All widgets are registered, not hardcoded.
 */
export function DashboardWorkspace({ preset = 'default' }: DashboardWorkspaceProps) {
  const { actions, visible, fullscreen, columns } = useWidgetLayout(preset);
  const gap = 4;

  return (
    <RuntimeProvider>
      <div className="p-4 h-full overflow-auto" style={{ background: 'var(--surface-0)' }}>
        <LayoutRenderer
          instances={visible}
          actions={actions}
          columns={columns}
          gap={gap}
          fullscreenInstance={fullscreen}
        />
      </div>
    </RuntimeProvider>
  );
}
