'use client';

import { useReducer, useMemo } from 'react';
import type { WidgetInstance, WidgetSize, LayoutAction } from './types';

export interface LayoutState {
  instances: WidgetInstance[];
  fullscreenInstanceId: string | null;
}

function layoutReducer(state: LayoutState, action: LayoutAction): LayoutState {
  switch (action.type) {
    case 'move':
      return {
        ...state,
        instances: state.instances.map(inst =>
          inst.instanceId === action.instanceId
            ? { ...inst, x: action.x, y: action.y }
            : inst
        ),
      };

    case 'resize':
      return {
        ...state,
        instances: state.instances.map(inst =>
          inst.instanceId === action.instanceId
            ? { ...inst, size: action.size }
            : inst
        ),
      };

    case 'collapse':
      return {
        ...state,
        instances: state.instances.map(inst =>
          inst.instanceId === action.instanceId
            ? { ...inst, collapsed: !inst.collapsed }
            : inst
        ),
      };

    case 'pin':
      return {
        ...state,
        instances: state.instances.map(inst =>
          inst.instanceId === action.instanceId
            ? { ...inst, pinned: !inst.pinned }
            : inst
        ),
      };

    case 'fullscreen':
      return {
        ...state,
        fullscreenInstanceId:
          state.fullscreenInstanceId === action.instanceId ? null : action.instanceId,
      };

    case 'close':
      return {
        ...state,
        instances: state.instances.filter(inst => inst.instanceId !== action.instanceId),
        fullscreenInstanceId:
          state.fullscreenInstanceId === action.instanceId ? null : state.fullscreenInstanceId,
      };

    case 'add':
      return { ...state, instances: [...state.instances, action.instance] };

    case 'settings':
      return {
        ...state,
        instances: state.instances.map(inst =>
          inst.instanceId === action.instanceId
            ? { ...inst, settings: action.settings }
            : inst
        ),
      };

    default:
      return state;
  }
}

export interface LayoutActions {
  move: (instanceId: string, x: number, y: number) => void;
  resize: (instanceId: string, size: WidgetSize) => void;
  toggleCollapse: (instanceId: string) => void;
  togglePin: (instanceId: string) => void;
  toggleFullscreen: (instanceId: string) => void;
  close: (instanceId: string) => void;
  add: (instance: WidgetInstance) => void;
  updateSettings: (instanceId: string, settings: Record<string, unknown>) => void;
}

export function useLayoutEngine(initial: WidgetInstance[] = []): {
  state: LayoutState;
  actions: LayoutActions;
  fullscreen: WidgetInstance | null;
  visible: WidgetInstance[];
} {
  const [state, dispatch] = useReducer(layoutReducer, { instances: initial, fullscreenInstanceId: null });

  const actions: LayoutActions = useMemo(() => ({
    move: (instanceId, x, y) => dispatch({ type: 'move', instanceId, x, y }),
    resize: (instanceId, size) => dispatch({ type: 'resize', instanceId, size }),
    toggleCollapse: (instanceId) => dispatch({ type: 'collapse', instanceId }),
    togglePin: (instanceId) => dispatch({ type: 'pin', instanceId }),
    toggleFullscreen: (instanceId) => dispatch({ type: 'fullscreen', instanceId }),
    close: (instanceId) => dispatch({ type: 'close', instanceId }),
    add: (instance) => dispatch({ type: 'add', instance }),
    updateSettings: (instanceId, settings) => dispatch({ type: 'settings', instanceId, settings }),
  }), []);

  const fullscreen = state.fullscreenInstanceId
    ? state.instances.find(i => i.instanceId === state.fullscreenInstanceId) ?? null
    : null;

  const visible = state.instances.filter(i => !i.collapsed);

  return { state, actions, fullscreen, visible };
}
