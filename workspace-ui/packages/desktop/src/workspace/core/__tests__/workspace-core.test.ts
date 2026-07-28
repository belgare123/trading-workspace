/**
 * Workspace Core Tests
 *
 * Tests for PanelRegistry, EventBus, CommandRegistry,
 * ServiceRegistry, CapabilityRegistry, and stores.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PanelRegistry } from '../PanelRegistry'
import { createWorkspaceEventBus } from '../EventBus'
import { createCommandRegistry, _resetCommands } from '../CommandRegistry'
import { ServiceRegistry } from '../ServiceRegistry'
import { CapabilityRegistry } from '../CapabilityRegistry'
import {
  useWorkspaceStore,
  usePanelStore,
  useSelectionStore,
  useThemeStore,
  useCommandStore,
} from '../store'
import type { PanelDefinition, Command, Service, WorkspaceApi } from '../types'

// ── Helpers ───────────────────────────────────────────

function makePanelDef(overrides: Partial<PanelDefinition> = {}): PanelDefinition {
  return {
    id: 'test-panel',
    title: 'Test Panel',
    icon: '📊',
    category: 'trading',
    component: () => null,
    ...overrides,
  }
}

// ── PanelRegistry ─────────────────────────────────────

describe('PanelRegistry', () => {
  beforeEach(() => {
    PanelRegistry.clear()
  })

  it('registers and retrieves a panel', () => {
    const def = makePanelDef()
    PanelRegistry.register(def)
    expect(PanelRegistry.get('test-panel')).toEqual(def)
  })

  it('returns undefined for unregistered panel', () => {
    expect(PanelRegistry.get('nonexistent')).toBeUndefined()
  })

  it('lists all registered panels', () => {
    const a = makePanelDef({ id: 'a', title: 'A' })
    const b = makePanelDef({ id: 'b', title: 'B' })
    PanelRegistry.register(a)
    PanelRegistry.register(b)
    expect(PanelRegistry.list()).toHaveLength(2)
    expect(PanelRegistry.list().map(p => p.id)).toEqual(['a', 'b'])
  })

  it('filters panels by category', () => {
    PanelRegistry.register(makePanelDef({ id: 'a', category: 'trading' }))
    PanelRegistry.register(makePanelDef({ id: 'b', category: 'analysis' }))
    PanelRegistry.register(makePanelDef({ id: 'c', category: 'trading' }))
    expect(PanelRegistry.listByCategory('trading')).toHaveLength(2)
    expect(PanelRegistry.listByCategory('ai')).toHaveLength(0)
  })

  it('overwrites existing panel on re-registration', () => {
    PanelRegistry.register(makePanelDef({ id: 'x', title: 'Old' }))
    PanelRegistry.register(makePanelDef({ id: 'x', title: 'New' }))
    expect(PanelRegistry.get('x')?.title).toBe('New')
  })

  it('unregisters a panel', () => {
    PanelRegistry.register(makePanelDef({ id: 'y' }))
    expect(PanelRegistry.has('y')).toBe(true)
    PanelRegistry.unregister('y')
    expect(PanelRegistry.has('y')).toBe(false)
  })

  it('counts registered panels', () => {
    expect(PanelRegistry.count()).toBe(0)
    PanelRegistry.register(makePanelDef({ id: 'a' }))
    PanelRegistry.register(makePanelDef({ id: 'b' }))
    expect(PanelRegistry.count()).toBe(2)
  })
})

// ── EventBus ──────────────────────────────────────────

describe('WorkspaceEventBus', () => {
  it('emits and receives events', () => {
    const bus = createWorkspaceEventBus()
    const received: string[] = []

    bus.on('panel:opened', (e) => {
      received.push(e.type)
    })

    bus.emit('panel:opened', { panelId: 'orders' })
    expect(received).toEqual(['panel:opened'])
  })

  it('supports multiple handlers per event type', () => {
    const bus = createWorkspaceEventBus()
    let count = 0

    bus.on('command:executed', () => { count++ })
    bus.on('command:executed', () => { count++ })
    bus.emit('command:executed')

    expect(count).toBe(2)
  })

  it('once fires only once', () => {
    const bus = createWorkspaceEventBus()
    let count = 0

    bus.once('panel:closed', () => { count++ })
    bus.emit('panel:closed')
    bus.emit('panel:closed')

    expect(count).toBe(1)
  })

  it('unsubscribe removes handler', () => {
    const bus = createWorkspaceEventBus()
    let count = 0

    const unsub = bus.on('layout:changed', () => { count++ })
    bus.emit('layout:changed')
    expect(count).toBe(1)

    unsub()
    bus.emit('layout:changed')
    expect(count).toBe(1) // still 1
  })

  it('clear removes all handlers for a type', () => {
    const bus = createWorkspaceEventBus()
    let count = 0

    bus.on('theme:changed', () => { count++ })
    bus.on('theme:changed', () => { count++ })
    bus.clear('theme:changed')
    bus.emit('theme:changed')

    expect(count).toBe(0)
  })

  it('clear without args removes all handlers', () => {
    const bus = createWorkspaceEventBus()
    let a = 0
    let b = 0

    bus.on('panel:opened', () => { a++ })
    bus.on('command:executed', () => { b++ })
    bus.clear()
    bus.emit('panel:opened')
    bus.emit('command:executed')

    expect(a).toBe(0)
    expect(b).toBe(0)
  })

  it('attaches timestamp to events', () => {
    const bus = createWorkspaceEventBus()
    const before = Date.now()

    bus.on('workspace:ready', (e) => {
      expect(e.timestamp).toBeGreaterThanOrEqual(before)
      expect(e.timestamp).toBeLessThanOrEqual(Date.now())
    })

    bus.emit('workspace:ready')
  })
})

// ── CommandRegistry ───────────────────────────────────

describe('CommandRegistry', () => {
  let api: ReturnType<typeof createCommandRegistry>
  const mockWorkspace = { panels: {} } as unknown as WorkspaceApi

  beforeEach(() => {
    _resetCommands()
    api = createCommandRegistry(mockWorkspace)
  })

  it('registers and retrieves commands', () => {
    const cmd: Command = {
      id: 'test.cmd',
      title: 'Test Command',
      handler: () => {},
    }
    api.register(cmd)
    expect(api.get('test.cmd')?.title).toBe('Test Command')
  })

  it('lists commands, optionally filtered by category', () => {
    api.register({ id: 'a', title: 'A', category: 'Workspace', handler: () => {} })
    api.register({ id: 'b', title: 'B', category: 'Panels', handler: () => {} })
    api.register({ id: 'c', title: 'C', category: 'Workspace', handler: () => {} })

    expect(api.list()).toHaveLength(3)
    expect(api.list('Workspace')).toHaveLength(2)
    expect(api.list('Panels')).toHaveLength(1)
  })

  it('executes a command handler', async () => {
    let executed = false
    api.register({
      id: 'test.exec',
      title: 'Exec',
      handler: () => { executed = true },
    })
    await api.execute('test.exec')
    expect(executed).toBe(true)
  })

  it('silently handles unknown command execution', async () => {
    await api.execute('nonexistent') // should not throw
  })

  it('searches commands by id, title, and category', () => {
    api.register({ id: 'workspace.open.chart', title: 'Open Chart', category: 'Panels', handler: () => {} })
    api.register({ id: 'workspace.fullscreen.toggle', title: 'Toggle Fullscreen', category: 'Workspace', handler: () => {} })

    expect(api.search('chart')).toHaveLength(1)
    expect(api.search('toggle')).toHaveLength(1)
    expect(api.search('workspace')).toHaveLength(2)
    expect(api.search('xyz')).toHaveLength(0)
  })

  it('unregisters a command', () => {
    api.register({ id: 'temp', title: 'Temp', handler: () => {} })
    expect(api.get('temp')).toBeDefined()
    api.unregister('temp')
    expect(api.get('temp')).toBeUndefined()
  })
})

// ── ServiceRegistry ───────────────────────────────────

describe('ServiceRegistry', () => {
  beforeEach(() => {
    // Clear services
    ServiceRegistry.list().forEach(s => ServiceRegistry.unregister(s.id))
  })

  it('registers and retrieves a service', () => {
    const svc: Service = { init: () => {} }
    ServiceRegistry.register({ id: 'test', title: 'Test', instance: svc })
    expect(ServiceRegistry.get<Service>('test')).toBe(svc)
  })

  it('returns undefined for unknown service', () => {
    expect(ServiceRegistry.get('unknown')).toBeUndefined()
  })

  it('lists registered services', () => {
    ServiceRegistry.register({ id: 'a', title: 'A', instance: {} })
    ServiceRegistry.register({ id: 'b', title: 'B', instance: {} })
    expect(ServiceRegistry.list()).toHaveLength(2)
  })

  it('calls init on all services', async () => {
    const inits: string[] = []
    ServiceRegistry.register({ id: 'x', title: 'X', instance: { init: () => { inits.push('x') } } })
    ServiceRegistry.register({ id: 'y', title: 'Y', instance: { init: () => { inits.push('y') } } })
    await ServiceRegistry.initAll()
    expect(inits).toEqual(['x', 'y'])
  })

  it('calls destroy in reverse order', async () => {
    const order: string[] = []
    ServiceRegistry.register({ id: 'a', title: 'A', instance: { destroy: () => { order.push('a') } } })
    ServiceRegistry.register({ id: 'b', title: 'B', instance: { destroy: () => { order.push('b') } } })
    await ServiceRegistry.destroyAll()
    expect(order).toEqual(['b', 'a'])
  })
})

// ── CapabilityRegistry ────────────────────────────────

describe('CapabilityRegistry', () => {
  beforeEach(() => {
    CapabilityRegistry.list().forEach(e => CapabilityRegistry.unregister(e.panelId))
  })

  it('registers capabilities for a panel', () => {
    CapabilityRegistry.register('chart', ['chart', 'trading'])
    expect(CapabilityRegistry.get('chart')).toEqual(['chart', 'trading'])
  })

  it('finds panels by ALL required capabilities', () => {
    CapabilityRegistry.register('chart', ['chart'])
    CapabilityRegistry.register('trading', ['trading', 'chart'])
    CapabilityRegistry.register('log', ['log'])

    const withChart = CapabilityRegistry.findAll(['chart'])
    expect(withChart).toEqual(['chart', 'trading'])
  })

  it('finds panels by ANY capability', () => {
    CapabilityRegistry.register('a', ['chart'])
    CapabilityRegistry.register('b', ['log'])
    CapabilityRegistry.register('c', ['ai'])

    expect(CapabilityRegistry.findAny(['chart', 'ai'])).toEqual(['a', 'c'])
  })

  it('updates capabilities', () => {
    CapabilityRegistry.register('panel', ['chart'])
    CapabilityRegistry.update('panel', ['chart', 'ai', 'trading'])
    expect(CapabilityRegistry.get('panel')).toEqual(['chart', 'ai', 'trading'])
  })

  it('unregisters capabilities', () => {
    CapabilityRegistry.register('panel', ['chart'])
    expect(CapabilityRegistry.get('panel')).toBeDefined()
    CapabilityRegistry.unregister('panel')
    expect(CapabilityRegistry.get('panel')).toBeUndefined()
  })

  it('lists all capability entries', () => {
    CapabilityRegistry.register('a', ['chart'])
    CapabilityRegistry.register('b', ['log'])
    const list = CapabilityRegistry.list()
    expect(list).toHaveLength(2)
    expect(list.find(e => e.panelId === 'a')?.capabilities).toEqual(['chart'])
  })
})

// ── Zustand Stores ────────────────────────────────────

describe('WorkspaceStore', () => {
  it('initializes with sensible defaults', () => {
    const state = useWorkspaceStore.getState()
    expect(state.ready).toBe(false)
    expect(state.fullscreen).toBe(false)
    expect(state.sidebarVisible).toBe(true)
    expect(state.statusBarVisible).toBe(true)
  })

  it('toggles sidebar', () => {
    useWorkspaceStore.getState().toggleSidebar()
    expect(useWorkspaceStore.getState().sidebarVisible).toBe(false)
    useWorkspaceStore.getState().toggleSidebar()
    expect(useWorkspaceStore.getState().sidebarVisible).toBe(true)
  })

  it('sets ready', () => {
    useWorkspaceStore.getState().setReady()
    expect(useWorkspaceStore.getState().ready).toBe(true)
  })
})

describe('PanelStore (Zustand)', () => {
  it('opens and closes panels', () => {
    usePanelStore.getState().openPanel('orders')
    expect(usePanelStore.getState().isOpen('orders')).toBe(true)
    expect(usePanelStore.getState().activePanel).toBe('orders')

    usePanelStore.getState().closePanel('orders')
    expect(usePanelStore.getState().isOpen('orders')).toBe(false)
  })

  it('toggles panels', () => {
    usePanelStore.getState().togglePanel('chart')
    expect(usePanelStore.getState().isOpen('chart')).toBe(true)
    usePanelStore.getState().togglePanel('chart')
    expect(usePanelStore.getState().isOpen('chart')).toBe(false)
  })
})

describe('SelectionStore', () => {
  it('selects and deselects panels', () => {
    useSelectionStore.getState().select('chart')
    expect(useSelectionStore.getState().panels).toEqual(['chart'])
    expect(useSelectionStore.getState().activePanel).toBe('chart')

    useSelectionStore.getState().deselect('chart')
    expect(useSelectionStore.getState().panels).toEqual([])
  })

  it('sets context', () => {
    useSelectionStore.getState().setContext({ tradeId: '123' })
    expect(useSelectionStore.getState().context).toEqual({ tradeId: '123' })
  })

  it('clears selection', () => {
    useSelectionStore.getState().select('a')
    useSelectionStore.getState().select('b')
    useSelectionStore.getState().setContext({ key: 'val' })
    useSelectionStore.getState().clearSelection()
    expect(useSelectionStore.getState().panels).toEqual([])
    expect(useSelectionStore.getState().context).toEqual({})
  })
})

describe('ThemeStore', () => {
  it('has a default dark theme', () => {
    const theme = useThemeStore.getState().getTheme()
    expect(theme.id).toBe('dark-terminal')
    expect(theme.colors.bg).toBe('#0b0e14')
  })

  it('registers and switches themes', () => {
    const light = { id: 'light', name: 'Light', colors: { bg: '#fff', surface: '#eee', border: '#ccc', accent: '#000', profit: '#0a0', loss: '#a00', text: '#000', textMuted: '#888' } }
    useThemeStore.getState().registerTheme(light)
    expect(useThemeStore.getState().listThemes()).toHaveLength(2)

    useThemeStore.getState().setTheme('light')
    expect(useThemeStore.getState().currentId).toBe('light')
  })
})
