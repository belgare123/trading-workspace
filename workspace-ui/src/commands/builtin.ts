import { globalCommandRegistry } from './CommandRegistry'
import { useStore } from '../store'

/**
 * Register all built-in Workspace commands.
 * Called once at app startup inside CommandProvider.
 */
export function registerBuiltInCommands(): void {
  const reg = globalCommandRegistry

  // ── Navigation ───────────────────────────────────────────────────

  reg.register({
    id: 'nav.dashboard',
    title: 'Go to Dashboard',
    category: 'Navigation',
    keywords: ['dashboard', 'home', 'main'],
    shortcut: 'Ctrl+T',
    run: () => useStore.getState().setActiveView('dashboard'),
  })

  reg.register({
    id: 'nav.dashboard.overview',
    title: 'Dashboard: Overview',
    category: 'Navigation',
    keywords: ['dashboard', 'overview', 'default'],
    run: () => {
      useStore.getState().setActiveView('dashboard')
      useStore.getState().setDashboardPreset('default')
    },
  })

  reg.register({
    id: 'nav.dashboard.trading',
    title: 'Dashboard: Trading',
    category: 'Navigation',
    keywords: ['dashboard', 'trading', 'chart', 'orders'],
    run: () => {
      useStore.getState().setActiveView('dashboard')
      useStore.getState().setDashboardPreset('trading')
    },
  })

  reg.register({
    id: 'nav.dashboard.research',
    title: 'Dashboard: Research',
    category: 'Navigation',
    keywords: ['dashboard', 'research', 'strategies', 'analysis'],
    run: () => {
      useStore.getState().setActiveView('dashboard')
      useStore.getState().setDashboardPreset('research')
    },
  })

  reg.register({
    id: 'nav.dashboard.monitoring',
    title: 'Dashboard: Monitoring',
    category: 'Navigation',
    keywords: ['dashboard', 'monitoring', 'health', 'system'],
    run: () => {
      useStore.getState().setActiveView('dashboard')
      useStore.getState().setDashboardPreset('monitoring')
    },
  })

  reg.register({
    id: 'nav.scanner',
    title: 'Go to Scanner',
    category: 'Navigation',
    keywords: ['scan', 'pairs', 'market'],
    shortcut: 'Ctrl+1',
    run: () => useStore.getState().setActiveView('scanner'),
  })

  reg.register({
    id: 'nav.inspector',
    title: 'Go to Inspector',
    category: 'Navigation',
    keywords: ['inspect', 'details', 'symbol'],
    shortcut: 'Ctrl+2',
    run: () => useStore.getState().setActiveView('inspector'),
  })

  reg.register({
    id: 'nav.strategies',
    title: 'Go to Strategies',
    category: 'Navigation',
    keywords: ['strategy', 'monitor'],
    shortcut: 'Ctrl+3',
    run: () => useStore.getState().setActiveView('strategies'),
  })

  reg.register({
    id: 'nav.replay',
    title: 'Go to Replay',
    category: 'Navigation',
    keywords: ['playback', 'backtest'],
    shortcut: 'Ctrl+4',
    run: () => useStore.getState().setActiveView('replay'),
  })

  reg.register({
    id: 'nav.plugins',
    title: 'Go to Plugin Store',
    category: 'Navigation',
    keywords: ['plugin', 'extensions', 'marketplace'],
    shortcut: 'Ctrl+5',
    run: () => useStore.getState().setActiveView('plugins'),
  })

  reg.register({
    id: 'nav.learning',
    title: 'Go to Learning Hub',
    category: 'Navigation',
    keywords: ['learn', 'docs', 'ml', 'training'],
    shortcut: 'Ctrl+6',
    run: () => useStore.getState().setActiveView('learning'),
  })

  reg.register({
    id: 'nav.system',
    title: 'Go to System Monitor',
    category: 'Navigation',
    keywords: ['system', 'monitor', 'health', 'metrics'],
    shortcut: 'Ctrl+7',
    run: () => useStore.getState().setActiveView('system'),
  })

  // ── Inspector ────────────────────────────────────────────────────

  reg.register({
    id: 'inspector.open',
    title: 'Inspect Symbol...',
    subtitle: 'Open Inspector for a specific symbol',
    category: 'Inspector',
    keywords: ['inspect', 'detail', 'symbol'],
    shortcut: 'Ctrl+I',
    run: (_params?: Record<string, unknown>) => {
      useStore.getState().setActiveView('inspector')
    },
  })

  // ── Replay ───────────────────────────────────────────────────────

  reg.register({
    id: 'replay.start',
    title: 'Start Replay',
    category: 'Replay',
    keywords: ['playback', 'run', 'start'],
    shortcut: 'Ctrl+Shift+R',
    enabled: () => useStore.getState().replay.status !== 'playing',
    run: () => useStore.getState().setReplay({ status: 'playing' }),
  })

  reg.register({
    id: 'replay.pause',
    title: 'Pause Replay',
    category: 'Replay',
    keywords: ['playback', 'stop', 'pause'],
    shortcut: 'Ctrl+Shift+P',
    enabled: () => useStore.getState().replay.status === 'playing',
    run: () => useStore.getState().setReplay({ status: 'paused' }),
  })

  reg.register({
    id: 'replay.speedUp',
    title: 'Increase Replay Speed',
    category: 'Replay',
    keywords: ['speed', 'fast', 'faster'],
    run: () => {
      const s = useStore.getState().replay.speed
      useStore.getState().setReplay({ speed: Math.min(s * 2, 64) })
    },
  })

  reg.register({
    id: 'replay.speedDown',
    title: 'Decrease Replay Speed',
    category: 'Replay',
    keywords: ['speed', 'slow', 'slower'],
    run: () => {
      const s = useStore.getState().replay.speed
      useStore.getState().setReplay({ speed: Math.max(s / 2, 0.25) })
    },
  })

  // ── View ─────────────────────────────────────────────────────────

  reg.register({
    id: 'view.togglePanel',
    title: 'Toggle Right Panel',
    category: 'View',
    keywords: ['panel', 'sidebar', 'toggle'],
    shortcut: 'Ctrl+B',
    run: () => useStore.getState().toggleRightPanel(),
  })

  reg.register({
    id: 'view.toggleTimeline',
    title: 'Toggle Timeline',
    category: 'View',
    keywords: ['timeline', 'events', 'log', 'toggle'],
    shortcut: 'Ctrl+L',
    run: () => useStore.getState().toggleTimeline(),
  })

  reg.register({
    id: 'view.openCommandPalette',
    title: 'Open Command Palette',
    category: 'View',
    keywords: ['palette', 'commands', 'search'],
    shortcut: 'Ctrl+K',
    run: () => {
      // This is handled by the global key handler; here as a placeholder
    },
  })

  // ── System ───────────────────────────────────────────────────────

  reg.register({
    id: 'system.clearTimeline',
    title: 'Clear Timeline Events',
    category: 'System',
    keywords: ['timeline', 'clear', 'events'],
    run: async () => {
      const { useTimelineStore } = await import('../timeline')
      useTimelineStore.getState().clear()
    },
  })
}
