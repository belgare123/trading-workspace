import type { ComponentType, ReactNode } from 'react';
import type { MarketApi, ReplayApi, PluginApi, SignalApi } from './api';
import type { EventBus } from './EventBus';
import type { RuntimeApiServices } from './api';
import type { Capability } from './Capabilities';

// ── Categories ──
export type WidgetCategory = 'analysis' | 'trading' | 'monitoring' | 'ml' | 'system';

// ── Grid size ──
export interface WidgetSize {
  cols: number;
  rows: number;
}

// ── Widget life cycle ──
export interface WidgetLifecycle {
  onMount?: () => void | Promise<void>;
  onActivate?: () => void;
  onDeactivate?: () => void;
  onResize?: (size: WidgetSize) => void;
  onSettingsChanged?: (settings: Record<string, unknown>) => void;
  onDestroy?: () => void;
}

// ── Settings schema ──
export interface WidgetSettingField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  options?: { label: string; value: string }[];
  default?: unknown;
}

export interface WidgetSettingsSchema {
  fields: WidgetSettingField[];
}

// ── Widget definition (registered once) ──
export interface WidgetDefinition {
  /** Уникальный ID */
  id: string;
  /** Человеческое название */
  title: string;
  /** Иконка (lucide-имя или ReactNode) */
  icon?: ReactNode;
  /** Краткое описание */
  description?: string;
  /** Расширенное описание (для Marketplace) */
  longDescription?: string;
  /** Категория */
  category: WidgetCategory;
  /** Теги для поиска */
  tags?: string[];
  /** Ключевые слова для поиска */
  keywords?: string[];
  /** Автор */
  author?: string;
  /** Версия виджета */
  version?: string;
  /** Сайт */
  homepage?: string;
  /** Лицензия */
  license?: string;
  /** URL превью-изображения */
  preview?: string;

  /** Размер по умолчанию */
  defaultSize: WidgetSize;
  /** Минимальный размер */
  minSize?: WidgetSize;
  /** Максимальный размер */
  maxSize?: WidgetSize;

  /** Компонент рендера */
  render: ComponentType<WidgetProps>;
  /** Схема настроек */
  settings?: WidgetSettingsSchema;
  /** Настройки по умолчанию */
  defaultSettings?: Record<string, unknown>;

  /** Зависимости от сервисов (DI) */
  dependencies?: string[];
  /** Требуемые права */
  requires?: Capability[];
}

// ── Props passed to each widget renderer ──
export interface WidgetProps {
  instanceId: string;
  definition: WidgetDefinition;
  size: WidgetSize;
  settings: Record<string, unknown>;
  runtime: RuntimeApi;
  onSettingsChange: (settings: Record<string, unknown>) => void;
}

// ── Widget instance (placed in a layout) ──
export interface WidgetInstance {
  instanceId: string;
  definitionId: string;
  x: number;
  y: number;
  size: WidgetSize;
  settings: Record<string, unknown>;
  pinned: boolean;
  collapsed: boolean;
}

// ── Dashboard preset ──
export interface DashboardPreset {
  id: string;
  title: string;
  description?: string;
  columns: string;
  autoRows?: string;
  widgets: WidgetPlacement[];
}

export interface WidgetPlacement {
  widget: string;
  x: number;
  y: number;
  w: number;
  h: number;
  settings?: Record<string, unknown>;
}

// ── Runtime API exposed to widgets ──
export interface RuntimeApi {
  events: EventBus;
  services: RuntimeServicesProxy;
  market: () => MarketApi;
  replay: () => ReplayApi;
  system: () => SystemApi;
  plugins: () => PluginApi;
  signals: () => SignalApi;
}

// ── Service Discovery Proxy ──
export interface RuntimeServicesProxy {
  market:       import('./api').MarketApi
  replay:       import('./api').ReplayApi
  plugins:      import('./api').PluginApi
  signals:      SignalApi
  system:       SystemApi
  portfolio:    import('./api/portfolio').PortfolioApi
  strategy:     import('./api/strategy').StrategyApi
  ml:           import('./api/ml').MLApi
  notification: import('./api/notification').NotificationApi
  search:       import('./api/search').SearchApi
  eventStore:   import('./api/eventstore').EventStoreApi
}

// ── Widget-local API (minimal proxies for widgets) ──
// These are intentionally smaller than the full service API.
export interface WidgetMarketApi {
  getPrice: (symbol: string) => Promise<number>;
  subscribe: (symbol: string, cb: (price: number) => void) => () => void;
}

export interface WidgetReplayApi {
  isActive: () => boolean;
  currentTime: () => string;
  play: () => void;
  pause: () => void;
  seek: (time: string) => void;
}

export interface WidgetPluginApi {
  list: () => Promise<string[]>;
  enable: (id: string) => Promise<void>;
  disable: (id: string) => Promise<void>;
}

export interface SystemApi {
  health: () => Promise<Record<string, number>>;
  services: () => Promise<string[]>;
}

export interface SignalApi {
  list: () => Promise<unknown[]>;
  subscribe: (cb: (signal: unknown) => void) => () => void;
}

// ── Layout actions ──
export type LayoutAction =
  | { type: 'move'; instanceId: string; x: number; y: number }
  | { type: 'resize'; instanceId: string; size: WidgetSize }
  | { type: 'collapse'; instanceId: string }
  | { type: 'pin'; instanceId: string }
  | { type: 'fullscreen'; instanceId: string }
  | { type: 'close'; instanceId: string }
  | { type: 'add'; instance: WidgetInstance }
  | { type: 'settings'; instanceId: string; settings: Record<string, unknown> };
