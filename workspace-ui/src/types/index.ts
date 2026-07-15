// Core domain types for Workspace UI

export interface ScannerItem {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  score: number
  signals: string[]
  direction: string
  timestamp: number
}

export interface Signal {
  direction: 'long' | 'short' | 'neutral'
  score: number
  confidence: number
  strategy: string
}

export interface Opportunity {
  id: string
  symbol: string
  direction: 'long' | 'short'
  score: number
  confidence: number
  entry: number
  sl: number
  tp: number
  strategies: string[]
  timestamp: number
}

export interface StrategyMeta {
  name: string
  description: string
  category: string
  version: string
  status: 'active' | 'paused' | 'error'
  health: number
  signals24h: number
  pnl24h: number
  cpu: number
}

export interface PluginMeta {
  id: string
  name: string
  version: string
  description: string
  author: string
  rating: number
  downloads: number
  installed: boolean
}

export interface ReplayState {
  status: 'idle' | 'playing' | 'paused'
  speed: number
  currentTime: number
  totalTime: number
  bookmarks: number[]
}

export interface SystemMetric {
  name: string
  value: number
  unit: string
  status: 'ok' | 'warn' | 'error'
}

export interface SystemMetrics {
  runtime: number
  pnl: number
  signals: number
  events: number
  cpu: number
  memory: number
  ws_clients: number
  connected: boolean
}

export interface ComponentStatus {
  name: string
  status: 'healthy' | 'degraded' | 'critical'
  value: string
}

export interface HealthData {
  overall_score: number
  status: 'healthy' | 'degraded' | 'critical'
  components: ComponentStatus[]
}

// WebSocket message types
export type WsMessage =
  | { type: 'scanner_update'; data: ScannerItem[] }
  | { type: 'opportunity'; data: Opportunity }
  | { type: 'system_metric'; data: SystemMetric }
  | { type: 'event'; data: unknown }
  | { type: 'replay_frame'; data: unknown }

export interface TraceNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: {
    label: string
    status: 'ok' | 'warn' | 'error'
    detail: string
  }
}

export interface TraceEdge {
  id: string
  source: string
  target: string
}

export interface TraceGraph {
  symbol: string
  nodes: TraceNode[]
  edges: TraceEdge[]
}

export interface FeatureInspect {
  symbol: string
  features: Record<string, string | number>
  decision_chain: string[]
}

export interface PlaybackSession {
  id: string
  name: string
  symbol: string
  events: number
  duration: string
  strategies: string[]
  status: string
}

export interface PlaybackState {
  session_id: string | null
  status: 'stopped' | 'paused' | 'playing'
  current_step: number
  speed: number
  events: PlaybackEvent[]
}

export interface PlaybackEvent {
  step: number
  id: string
  timestamp: number
  type: string
  symbol: string
  data: Record<string, unknown>
}

export interface StrategySummary {
  id: string
  name: string
  symbol: string
  status: 'running' | 'paused' | 'stopped'
  type: string
  timeframe: string
  metrics: StrategyMetrics
}

export interface StrategyMetrics {
  pnl: number
  pnl_percent: number
  win_rate: number
  profit_factor: number
  sharpe: number
  max_drawdown: number
  total_trades: number
  avg_trade?: number
  avg_win?: number
  avg_loss?: number
  expectancy?: number
}

export interface OpenPosition {
  symbol: string
  direction: 'LONG' | 'SHORT'
  entry: number
  current: number
  pnl: number
  pnl_percent: number
  size: number
  stop: number
  target: number
  duration: string
}

export interface RecentTrade {
  id: string
  symbol: string
  direction: 'LONG' | 'SHORT'
  entry: number
  exit: number
  pnl: number
  pnl_percent: number
  closed_at: string
  reason: string
}

export interface StrategyDetail extends StrategySummary {
  version: string
  open_positions: OpenPosition[]
  recent_trades: RecentTrade[]
  equity_curve: { date: string; value: number }[]
  metrics: StrategyMetrics
}

export interface StrategyMetricsData {
  equity_curve: { date: string; value: number }[]
  metrics: StrategyMetrics
}

// ── Plugin Store ──────────────────────────────────

export interface Category {
  name: string
  count: number
}

export interface PluginSummary {
  name: string
  display_name: string
  description: string
  package_type: string
  author: string
  icon: string
  trust_level: string
  latest_version: string
  rating: number
  rating_count: number
  install_count: number
  stars_display: string
}

export interface PluginDetail {
  name: string
  display_name: string
  description: string
  package_type: string
  author: string
  license: string
  tags: string[]
  categories: string[]
  icon: string
  trust: TrustDisplay
  latest_version: string
  versions: string[]
  community: CommunityStats | null
  channels: Record<string, string>
  passport: StrategyPassport | null
  benchmarks: BenchmarkItem[]
  compatibility: CompatibilityReport
  installed: boolean
}

export interface TrustDisplay {
  label: string
  color: string
  icon: string
  description: string
}

export interface CommunityStats {
  rating: number
  rating_count: number
  review_count: number
  install_count: number
  active_users: number
  stars: number
  trending_score: number
}

export interface StrategyPassport {
  name: string
  display_name: string
  version: string
  author: string
  description: string
  strategy_type: string
  timeframes: string[]
  exchanges: string[]
  min_core_version: string
  required_capabilities: string[]
  features_used: string[]
  indicators: string[]
  benchmark_winrate: number | null
  benchmark_profit_factor: number | null
  benchmark_max_dd: number | null
  benchmark_sharpe: number | null
  benchmark_trades: number
  benchmark_period: string
  tags: string[]
  license: string
  rating: number
  rating_count: number
  trust_level: string
}

export interface BenchmarkItem {
  strategy_name: string
  symbol: string
  timeframe: string
  period: string
  winrate: number
  profit_factor: number
  max_drawdown: number
  sharpe_ratio: number
  sortino_ratio: number
  total_trades: number
  win_trades: number
  loss_trades: number
}

export interface CompatibilityReport {
  package_name: string
  version: string
  core_compatible: boolean
  api_compatible: boolean
  exchanges_missing: string[]
  capabilities_missing: string[]
  dependencies_missing: string[]
  can_install: boolean
  warnings: string[]
  errors: string[]
}

// ── ML Workbench ─────────────────────────────────────────────────

export type ModelStatus = 'draft' | 'training' | 'ready' | 'production' | 'failed' | 'archived'

export interface ClassificationMetrics {
  accuracy: number
  precision: number
  recall: number
  f1_score: number
  roc_auc: number
}

export interface TrainingMetrics {
  epoch: number
  total_epochs: number
  loss: number
  accuracy: number
  val_loss: number
  val_accuracy: number
  learning_rate: number
}

export interface Hyperparams {
  learning_rate: number
  batch_size: number
  epochs: number
  optimizer: string
  loss_fn: string
  dropout: number
  hidden_layers: number[]
}

export interface DatasetInfo {
  name: string
  version: string
  rows: number
  features: string[]
  target: string
  description: string
}

export interface ConfusionMatrix {
  labels: string[]
  matrix: number[][]
}

export interface FeatureImportance {
  name: string
  importance: number
}

export interface ModelSummary {
  id: string
  name: string
  description: string
  version: string
  status: ModelStatus
  model_type: string
  framework: string
  accuracy: number
  last_trained: string
  tags: string[]
}

export interface ModelDetail extends ModelSummary {
  hyperparams: Hyperparams
  dataset: DatasetInfo
  metrics: ClassificationMetrics
  confusion_matrix: ConfusionMatrix
  feature_importance: FeatureImportance[]
  created_at: string
  updated_at: string
}

export interface TrainingRun {
  id: string
  model_id: string
  model_name: string
  status: string
  progress: number
  current_epoch: number
  total_epochs: number
  metrics: TrainingMetrics
  started_at: string
  eta: string
}

export type ExperimentStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export interface Experiment {
  id: string
  name: string
  model_id: string
  model_name: string
  status: ExperimentStatus
  dataset_name: string
  accuracy: number
  duration_seconds: number
  hyperparams: Hyperparams
  started_at: string
  completed_at: string
  tags: string[]
}

export interface EvaluateResult {
  model_id: string
  model_name: string
  status: string
  metrics: ClassificationMetrics
  confusion_matrix: ConfusionMatrix
  feature_importance: FeatureImportance[]
}

// ── System Monitor Types ──────────────────────────────────────────

export interface RuntimeService {
  id: string
  name: string
  status: 'running' | 'stopped' | 'error' | 'degraded'
  uptime_seconds: number
  version: string
  pid: number
  port: number | null
}

export interface ResourceMetrics {
  cpu_percent: number
  memory_percent: number
  memory_mb: number
  threads: number
  sqlite_size_mb: number
  open_files: number
}

export interface EventStoreMetrics {
  total_events_today: number
  append_per_second: number
  active_readers: number
  stream_count: number
  snapshot_count: number
  replay_status: 'idle' | 'running' | 'paused'
  trace_queries: number
}

export interface WebSocketMetrics {
  total_clients: number
  clients_by_channel: Record<string, number>
}

export interface PluginRuntimeMetrics {
  installed: number
  enabled: number
  disabled: number
  errors: number
}

export interface TimelineEvent {
  id: string
  timestamp: string
  icon: string
  title: string
  description: string
  type: 'info' | 'success' | 'warning' | 'error'
}

export interface Alert {
  id: string
  type: 'critical' | 'warning' | 'info'
  title: string
  description: string
  timestamp: string
}

export interface ComponentScore {
  name: string
  score: number
  weight: number
  status: 'healthy' | 'degraded' | 'critical'
}

export interface HealthStatus {
  overall_score: number
  status: 'healthy' | 'degraded' | 'critical'
  components: ComponentScore[]
}

export interface SystemOverview {
  services: RuntimeService[]
  resources: ResourceMetrics
  event_store: EventStoreMetrics
  websockets: WebSocketMetrics
  plugins: PluginRuntimeMetrics
  timeline: TimelineEvent[]
  alerts: Alert[]
  health: HealthStatus
}
