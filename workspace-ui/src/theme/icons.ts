// Icon name constants — shared reference for Lucide icons used across the app

export const iconNames = {
  // Navigation
  analysis: 'layout-dashboard',
  portfolio: 'pie-chart',
  system: 'settings',
  tools: 'wrench',
  docs: 'book-open',
  settings: 'settings-2',

  // Actions
  search: 'search',
  notifications: 'bell',
  add: 'plus',
  remove: 'x',
  edit: 'pencil',
  copy: 'copy',
  delete: 'trash-2',
  close: 'x',
  maximize: 'maximize-2',
  minimize: 'minimize-2',

  // Trading
  long: 'trending-up',
  short: 'trending-down',
  chart: 'bar-chart-3',
  orderbook: 'book',
  trade: 'arrow-left-right',
  signal: 'zap',
  opportunity: 'target',
  performance: 'activity',

  // Status
  check: 'check-circle',
  alert: 'alert-circle',
  warning: 'alert-triangle',
  info: 'info',
  error: 'x-circle',
  loading: 'loader',
  pending: 'clock',
  success: 'check-circle-2',

  // Data
  table: 'table',
  grid: 'grid-3x3',
  list: 'list',
  timeline: 'clock-4',
  event: 'activity',
  flow: 'git-branch',
  node: 'circle',
  connection: 'link-2',
} as const;

export type IconName = keyof typeof iconNames;
