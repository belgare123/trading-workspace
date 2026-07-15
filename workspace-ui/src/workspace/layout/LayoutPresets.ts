/**
 * LayoutPresets — built-in workspace layout presets
 *
 * Registered on app boot via LayoutRegistry.
 * Each layout defines a set of panels with grid positions.
 *
 * @since 3.2.0
 */

import { createWorkspaceLayout, createPanel } from './WorkspaceLayout'
import { layoutRegistry } from './LayoutRegistry'
import type { WorkspaceLayout } from './types'

// ── Default — simple overview ──

const defaultLayout: WorkspaceLayout = createWorkspaceLayout('default', 'Default', [
  createPanel('default-overview', 'executive-overview', 'Overview'),
  createPanel('default-scanner', 'market-scanner', 'Scanner'),
])

// ── Trading — full trading workspace ──

const tradingLayout: WorkspaceLayout = createWorkspaceLayout('trading', 'Trading', [
  {
    ...createPanel('trading-chart', 'trading-chart', 'Chart'),
    position: { x: 0, y: 0, width: 0.5, height: 0.6 },
  },
  {
    ...createPanel('trading-orderbook', 'order-book', 'Order Book'),
    position: { x: 0.5, y: 0, width: 0.25, height: 0.6 },
  },
  {
    ...createPanel('trading-watchlist', 'market-watchlist', 'Watchlist'),
    position: { x: 0.75, y: 0, width: 0.25, height: 0.6 },
  },
  {
    ...createPanel('trading-executions', 'time-sales', 'Time & Sales'),
    position: { x: 0, y: 0.6, width: 0.33, height: 0.4 },
  },
  {
    ...createPanel('trading-overview', 'executive-overview', 'Overview'),
    position: { x: 0.33, y: 0.6, width: 0.34, height: 0.4 },
  },
  {
    ...createPanel('trading-news', 'news-feed', 'News'),
    position: { x: 0.67, y: 0.6, width: 0.33, height: 0.4 },
  },
])

// ── Scalping — fast entry/exit ──

const scalpingLayout: WorkspaceLayout = createWorkspaceLayout('scalping', 'Scalping', [
  {
    ...createPanel('scalp-chart', 'trading-chart', 'Chart'),
    position: { x: 0, y: 0, width: 0.4, height: 0.7 },
  },
  {
    ...createPanel('scalp-orderbook', 'order-book', 'Order Book'),
    position: { x: 0.4, y: 0, width: 0.3, height: 0.7 },
  },
  {
    ...createPanel('scalp-timesales', 'time-sales', 'Time & Sales'),
    position: { x: 0.7, y: 0, width: 0.3, height: 0.7 },
  },
  {
    ...createPanel('scalp-overview', 'executive-overview', 'Overview'),
    position: { x: 0, y: 0.7, width: 1, height: 0.3 },
  },
])

// ── Swing — medium-term ──

const swingLayout: WorkspaceLayout = createWorkspaceLayout('swing', 'Swing', [
  {
    ...createPanel('swing-chart', 'trading-chart', 'Chart'),
    position: { x: 0, y: 0, width: 0.6, height: 0.5 },
  },
  {
    ...createPanel('swing-overview', 'executive-overview', 'Overview'),
    position: { x: 0.6, y: 0, width: 0.4, height: 0.5 },
  },
  {
    ...createPanel('swing-scanner', 'market-scanner', 'Scanner'),
    position: { x: 0, y: 0.5, width: 0.5, height: 0.5 },
  },
  {
    ...createPanel('swing-opportunities', 'opportunities', 'Opportunities'),
    position: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
  },
])

// ── Research ──

const researchLayout: WorkspaceLayout = createWorkspaceLayout('research', 'Research', [
  {
    ...createPanel('research-scanner', 'market-scanner', 'Scanner'),
    position: { x: 0, y: 0, width: 0.4, height: 0.5 },
  },
  {
    ...createPanel('research-overview', 'executive-overview', 'Overview'),
    position: { x: 0.4, y: 0, width: 0.6, height: 0.5 },
  },
  {
    ...createPanel('research-chart', 'trading-chart', 'Chart'),
    position: { x: 0, y: 0.5, width: 0.5, height: 0.5 },
  },
  {
    ...createPanel('research-signals', 'live-signals', 'Signals'),
    position: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
  },
])

// ── ML — Machine Learning focus ──

const mlLayout: WorkspaceLayout = createWorkspaceLayout('ml', 'ML', [
  {
    ...createPanel('ml-overview', 'executive-overview', 'Overview'),
    position: { x: 0, y: 0, width: 0.5, height: 0.4 },
  },
  {
    ...createPanel('ml-strategies', 'strategy-status', 'Strategies'),
    position: { x: 0.5, y: 0, width: 0.5, height: 0.4 },
  },
  {
    ...createPanel('ml-scanner', 'market-scanner', 'Scanner'),
    position: { x: 0, y: 0.4, width: 0.33, height: 0.6 },
  },
  {
    ...createPanel('ml-signals', 'live-signals', 'Signals'),
    position: { x: 0.33, y: 0.4, width: 0.34, height: 0.6 },
  },
  {
    ...createPanel('ml-chart', 'trading-chart', 'Chart'),
    position: { x: 0.67, y: 0.4, width: 0.33, height: 0.6 },
  },
])

// ── Registration ──

export function registerLayoutPresets(): void {
  layoutRegistry.register(defaultLayout, 'Simple overview layout')
  layoutRegistry.register(tradingLayout, 'Full trading workspace with chart, order book, watchlist')
  layoutRegistry.register(scalpingLayout, 'Fast scalping setup with chart and order book')
  layoutRegistry.register(swingLayout, 'Medium-term swing trading workspace')
  layoutRegistry.register(researchLayout, 'Research-focused layout with scanner and signals')
  layoutRegistry.register(mlLayout, 'Machine learning strategy monitoring')
}
