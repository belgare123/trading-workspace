/**
 * RuntimePlayground — главный layout (4-панельный)
 *
 * Левая панель: навигация (Explorer, Services, Events, Plugins, Commands, Scripts, History)
 * Центр: активный инструмент (панель)
 * Правая панель: Live Inspector (Console, Logs, Errors, Latency, Memory)
 * Нижняя панель: Output (Output, Events, JSON, Timeline)
 *
 * @since 2.0.0
 */

import { usePlayground, type PanelId, type InspectorTab, type OutputTab } from './PlaygroundContext'
import { PlaygroundProvider } from './PlaygroundContext'
import { PlaygroundConsole } from './console/PlaygroundConsole'
import { EventEmitter } from './panels/EventEmitter'
import { ServiceConsole } from './panels/ServiceConsole'
import { CommandConsole } from './panels/CommandConsole'
import { PluginSandbox } from './panels/PluginSandbox'
import { CapabilityTester } from './panels/CapabilityTester'
import { RecorderControl } from './panels/RecorderControl'
import { StateExplorer } from './panels/StateExplorer'
import { ScriptRunner } from './panels/ScriptRunner'

/* ============================================================
 * Sidebar items
 * ============================================================ */

interface SidebarItem {
  id: PanelId
  icon: string
  label: string
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: 'event-emitter', icon: '📡', label: 'Event Emitter' },
  { id: 'service-console', icon: '⚡', label: 'Service Console' },
  { id: 'command-console', icon: '⌨️', label: 'Command Console' },
  { id: 'plugin-sandbox', icon: '🧩', label: 'Plugin Sandbox' },
  { id: 'capability-tester', icon: '🔐', label: 'Capability Tester' },
  { id: 'recorder-control', icon: '🔄', label: 'Recorder Control' },
  { id: 'state-explorer', icon: '🌳', label: 'State Explorer' },
  { id: 'script-runner', icon: '📜', label: 'Script Runner' },
]

const EXPLORER_TREE_ITEMS = [
  { id: 'services', icon: '⚙️', label: 'Services' },
  { id: 'events', icon: '📨', label: 'Events' },
  { id: 'plugins', icon: '🧩', label: 'Plugins' },
  { id: 'commands', icon: '⌨️', label: 'Commands' },
  { id: 'scripts', icon: '📜', label: 'Scripts' },
  { id: 'history', icon: '⏱️', label: 'History' },
]

const INSPECTOR_TABS: { id: InspectorTab; label: string }[] = [
  { id: 'console', label: 'Console' },
  { id: 'logs', label: 'Logs' },
  { id: 'errors', label: 'Errors' },
  { id: 'latency', label: 'Latency' },
  { id: 'memory', label: 'Memory' },
]

const OUTPUT_TABS: { id: OutputTab; label: string }[] = [
  { id: 'output', label: 'Output' },
  { id: 'events', label: 'Events' },
  { id: 'json', label: 'JSON' },
  { id: 'timeline', label: 'Timeline' },
]

/* ============================================================
 * Panel Renderer
 * ============================================================ */

function ActivePanel() {
  const { activePanel } = usePlayground()

  switch (activePanel) {
    case 'event-emitter': return <EventEmitter />
    case 'service-console': return <ServiceConsole />
    case 'command-console': return <CommandConsole />
    case 'plugin-sandbox': return <PluginSandbox />
    case 'capability-tester': return <CapabilityTester />
    case 'recorder-control': return <RecorderControl />
    case 'state-explorer': return <StateExplorer />
    case 'script-runner': return <ScriptRunner />
    default: return <EventEmitter />
  }
}

/* ============================================================
 * RuntimePlayground Inner
 * ============================================================ */

function RuntimePlaygroundInner() {
  const {
    activePanel, setActivePanel,
    activeInspectorTab, setActiveInspectorTab,
    activeOutputTab, setActiveOutputTab,
    activeTreeBranch, setActiveTreeBranch,
  } = usePlayground()

  return (
    <div className="runtime-playground">
      {/* ============== LEFT SIDEBAR: Tool Navigation ============== */}
      <div className="playground-left-sidebar">
        <div className="sidebar-section">
          <div className="sidebar-section-title">Explorer</div>
          {EXPLORER_TREE_ITEMS.map((item) => (
            <div
              key={item.id}
              className={`sidebar-item ${activeTreeBranch === item.id ? 'active' : ''}`}
              onClick={() => setActiveTreeBranch(item.id)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </div>
          ))}
        </div>
        <div className="sidebar-section">
          <div className="sidebar-section-title">Tools</div>
          {SIDEBAR_ITEMS.map((item) => (
            <div
              key={item.id}
              className={`sidebar-item ${activePanel === item.id ? 'active' : ''}`}
              onClick={() => setActivePanel(item.id)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ============== CENTER: Active Panel ============== */}
      <div className="playground-center">
        <ActivePanel />
      </div>

      {/* ============== RIGHT SIDEBAR: Live Inspector ============== */}
      <div className="playground-right-sidebar">
        <div className="inspector-tabs">
          {INSPECTOR_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`inspector-tab ${activeInspectorTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveInspectorTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="inspector-content">
          <PlaygroundConsole />
        </div>
      </div>

      {/* ============== BOTTOM: Output Panel ============== */}
      <div className="playground-bottom">
        <div className="bottom-tabs">
          {OUTPUT_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`bottom-tab ${activeOutputTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveOutputTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <div className="bottom-actions">
            <span className="bottom-minimize" onClick={() => {}}>─</span>
          </div>
        </div>
        <div className="bottom-content">
          <div className="bottom-placeholder">
            {activeOutputTab === 'output' && 'Output panel — see script results and event logs here'}
            {activeOutputTab === 'events' && 'Event stream — real-time display of all EventBus activity'}
            {activeOutputTab === 'json' && 'JSON view — inspect raw event payloads'}
            {activeOutputTab === 'timeline' && 'Timeline view — chronological event sequence'}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
 * RuntimePlayground (exported — wrapped in Provider)
 * ============================================================ */

/**
 * Runtime Playground — интерактивная лаборатория для разработчиков
 *
 * Использование:
 * ```tsx
 * import { RuntimePlayground } from '../runtime/devtools/runtime-playground/RuntimePlayground'
 *
 * <RuntimePlayground />
 * ```
 */
export function RuntimePlayground() {
  return (
    <PlaygroundProvider>
      <RuntimePlaygroundInner />
    </PlaygroundProvider>
  )
}
