import {
  LayoutDashboard,
  BarChart3,
  Radio,
  PieChart,
  BrainCircuit,
  Cpu,
  Play,
  BookOpen,
} from 'lucide-react'
import { ScreenRegistry } from './ScreenRegistry'

/**
 * registerWorkspaceScreens — registers the 8 Workspace Pro screens.
 *
 * Each screen maps to a Dashboard Preset in PresetRegistry.
 * After registration, Sidebar, Palette, Search, and Layout Manager
 * automatically discover these screens via ScreenRegistry.
 *
 * Must be called once at app boot (before first render).
 */
export function registerWorkspaceScreens(): void {
  const screens = [
    { id: 'overview',     title: 'Executive Overview', preset: 'executive-overview', icon: LayoutDashboard, category: 'workspace', order: 10 },
    { id: 'markets',      title: 'Markets',            preset: 'markets',            icon: BarChart3,       category: 'workspace', order: 20 },
    { id: 'signals',      title: 'Signals',            preset: 'signals',            icon: Radio,           category: 'workspace', order: 30 },
    { id: 'portfolio',    title: 'Portfolio',           preset: 'portfolio',         icon: PieChart,        category: 'workspace', order: 40 },
    { id: 'strategies',   title: 'Strategies',          preset: 'strategies',        icon: BrainCircuit,    category: 'workspace', order: 50 },
    { id: 'runtime',      title: 'Runtime',             preset: 'runtime',           icon: Cpu,             category: 'workspace', order: 60 },
    { id: 'replay',       title: 'Replay Studio',       preset: 'replay',            icon: Play,            category: 'workspace', order: 70 },
    { id: 'learning',     title: 'Learning',            preset: 'learning',          icon: BookOpen,        category: 'workspace', order: 80 },
  ] as const

  for (const screen of screens) {
    ScreenRegistry.register(screen)
  }
}
