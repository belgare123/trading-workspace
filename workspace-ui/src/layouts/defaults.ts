import type { WorkspaceLayout } from './types'

const CURRENT_VERSION = 1

export const DEFAULT_LAYOUTS: WorkspaceLayout[] = [
  {
    id: 'default',
    name: 'Default',
    layoutVersion: CURRENT_VERSION,
    views: { active: 'scanner', opened: ['scanner', 'inspector', 'replay', 'plugins'] },
    panels: { inspector: true, timeline: false, sidebar: true },
    sizes: { sidebar: 220, inspector: 380, timeline: 140 },
    preferences: { theme: 'dark', density: 'comfortable' },
  },
  {
    id: 'trading',
    name: 'Trading',
    layoutVersion: CURRENT_VERSION,
    views: { active: 'inspector', opened: ['inspector', 'scanner', 'strategies'] },
    panels: { inspector: true, timeline: true, sidebar: true },
    sizes: { sidebar: 260, inspector: 420, timeline: 160 },
    preferences: { theme: 'dark', density: 'compact' },
  },
  {
    id: 'research',
    name: 'Research',
    layoutVersion: CURRENT_VERSION,
    views: { active: 'learning', opened: ['learning', 'scanner', 'inspector'] },
    panels: { inspector: true, timeline: true, sidebar: true },
    sizes: { sidebar: 280, inspector: 400, timeline: 140 },
    preferences: { theme: 'dark', density: 'comfortable' },
  },
  {
    id: 'monitoring',
    name: 'Monitoring',
    layoutVersion: CURRENT_VERSION,
    views: { active: 'system', opened: ['system', 'plugins', 'strategies'] },
    panels: { inspector: false, timeline: true, sidebar: false },
    sizes: { sidebar: 0, inspector: 0, timeline: 180 },
    preferences: { theme: 'dark', density: 'comfortable' },
  },
  {
    id: 'replay',
    name: 'Replay',
    layoutVersion: CURRENT_VERSION,
    views: { active: 'replay', opened: ['replay', 'inspector', 'scanner'] },
    panels: { inspector: true, timeline: true, sidebar: true },
    sizes: { sidebar: 200, inspector: 360, timeline: 160 },
    preferences: { theme: 'dark', density: 'comfortable' },
  },
]
