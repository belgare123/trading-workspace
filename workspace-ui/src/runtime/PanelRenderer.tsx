'use client';

import { useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import { WidgetRegistry } from './WidgetRegistry';
import { useRuntime } from './RuntimeContext';
import type { WidgetInstance, WidgetProps, WidgetSize } from './types';
import type { LayoutActions } from './LayoutEngine';
import { Panel } from '../ui';
import { 
  Maximize2, Minimize2, Pin, PinOff, X, 
  GripHorizontal, ChevronDown, ChevronRight,
} from 'lucide-react';

interface PanelRendererProps {
  instance: WidgetInstance;
  actions: LayoutActions;
  columns: number;
  gap: number;
  isFullscreen?: boolean;
}

export function PanelRenderer({ instance, actions, columns, gap, isFullscreen }: PanelRendererProps) {
  const definition = WidgetRegistry.get(instance.definitionId);
  const runtime = useRuntime();
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const lifecycle = definition as unknown as { onMount?: () => void; onDestroy?: () => void };
    lifecycle?.onMount?.();
    return () => {
      mountedRef.current = false;
      lifecycle?.onDestroy?.();
    };
  }, [definition]);

  useEffect(() => {
    const lifecycle = definition as unknown as { onResize?: (size: WidgetSize) => void };
    lifecycle?.onResize?.(instance.size);
  }, [instance.size, definition]);

  if (!definition) {
    return (
      <Panel variant="glass" title={`Unknown: ${instance.definitionId}`}>
        <div className="text-xs text-[var(--text-muted)]">Widget not registered</div>
      </Panel>
    );
  }

  const Renderer = definition.render;
  const widgetProps: WidgetProps = {
    instanceId: instance.instanceId,
    definition,
    size: instance.size,
    settings: instance.settings,
    runtime,
    onSettingsChange: (settings) => actions.updateSettings(instance.instanceId, settings),
  };

  const colWidth = `(100% - ${(columns - 1) * gap * 4}px) / ${columns}`;
  const panelStyle: Record<string, string> = {
    position: 'absolute',
    left: `calc(${instance.x} * (${colWidth} + ${gap * 4}px))`,
    top: `calc(${instance.y} * (180px + ${gap * 4}px))`,
    width: `calc(${instance.size.cols} * (${colWidth} + ${gap * 4}px) - ${gap * 4}px)`,
    height: instance.collapsed ? 'auto' : `calc(${instance.size.rows} * (180px + ${gap * 4}px) - ${gap * 4}px)`,
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--border-base)] bg-[rgba(11,14,20,0.6)] backdrop-blur-[12px] overflow-hidden transition-shadow duration-200 group',
        instance.pinned && 'border-[var(--accent-blue)]/30 ring-1 ring-[var(--accent-blue)]/10',
        isFullscreen && 'fixed inset-4 z-50',
      )}
      style={isFullscreen ? undefined : panelStyle}
    >
      {/* Widget toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-base)] cursor-move select-none">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
          <GripHorizontal size={12} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
          {definition.title}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => actions.toggleCollapse(instance.instanceId)}
            className="w-6 h-6 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-tertiary)]"
            title={instance.collapsed ? 'Expand' : 'Collapse'}
          >
            {instance.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
          <button
            onClick={() => actions.togglePin(instance.instanceId)}
            className={cn('w-6 h-6 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center',
              instance.pinned ? 'text-[var(--accent-blue)]' : 'text-[var(--text-tertiary)]'
            )}
            title={instance.pinned ? 'Unpin' : 'Pin'}
          >
            {instance.pinned ? <PinOff size={12} /> : <Pin size={12} />}
          </button>
          <button
            onClick={() => actions.toggleFullscreen(instance.instanceId)}
            className="w-6 h-6 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-tertiary)]"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            onClick={() => actions.close(instance.instanceId)}
            className="w-6 h-6 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--accent-red)]"
            title="Close"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {!instance.collapsed && (
        <div className="p-3 overflow-auto h-[calc(100%-36px)]">
          <Renderer {...widgetProps} />
        </div>
      )}
    </div>
  );
}

interface LayoutRendererProps {
  instances: WidgetInstance[];
  actions: LayoutActions;
  columns: number;
  gap: number;
  fullscreenInstance: WidgetInstance | null;
}

export function LayoutRenderer({ instances, actions, columns, gap, fullscreenInstance }: LayoutRendererProps) {
  return (
    <div className="relative w-full h-full" style={{ minHeight: '600px' }}>
      {instances.map(inst => (
        <PanelRenderer
          key={inst.instanceId}
          instance={inst}
          actions={actions}
          columns={columns}
          gap={gap}
          isFullscreen={fullscreenInstance?.instanceId === inst.instanceId}
        />
      ))}
    </div>
  );
}
