/**
 * Hello Plugin — полноценный плагин с командами и поиском
 *
 * Добавляет к Example 1:
 * - register()/unregister() через PluginLoader
 * - Команды (CommandRegistry)
 * - Поиск (SearchAdapter)
 *
 * @since 2.0.0
 */

import { useState } from 'react'
import { WidgetRegistry } from '../../workspace-ui/src/runtime/WidgetRegistry'
import type { WidgetDefinition } from '../../workspace-ui/src/runtime/types'
import type { PluginContext } from '../../workspace-ui/src/runtime/PluginLoader'

/* ============================================================
 * 1. Widget
 * ============================================================ */

function HelloPluginWidget() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: 16, textAlign: 'center' }}>
      <h2>🧩 Hello Plugin</h2>
      <p>This plugin has commands and search too!</p>
      <p>You pressed me {count} times</p>
      <button onClick={() => setCount(c => c + 1)}>Click me</button>
    </div>
  )
}

const widgetDef: WidgetDefinition = {
  id: 'hello-plugin-widget',
  name: 'Hello Plugin Widget',
  description: 'Plugin with lifecycle, commands, and search',
  category: 'custom',
  defaultSize: { w: 3, h: 2 },
  component: HelloPluginWidget,
}

/* ============================================================
 * 2. Command
 * ============================================================ */

function greetCommand(name: string): void {
  const msg = `👋 Hello, ${name}! Plugin commands work.`
  console.log(msg)
  // В production — NotificationApi.send()
  alert(msg)
}

/* ============================================================
 * 3. Search Adapter
 * ============================================================ */

interface SearchResult {
  title: string
  description: string
  type: string
  url: string
}

async function helloSearch(query: string): Promise<SearchResult[]> {
  if (query.toLowerCase().includes('hello')) {
    return [
      {
        title: 'Hello Plugin',
        description: 'Example plugin showing full lifecycle',
        type: 'plugin',
        url: '/plugins/hello',
      },
    ]
  }
  return []
}

/* ============================================================
 * 4. register / unregister
 * ============================================================ */

export function register(ctx: PluginContext): void {
  console.log('[Hello Plugin] Installing...')

  // 4a. Register widget
  WidgetRegistry.register(widgetDef)

  // 4b. Register command
  ctx.commands.register({
    id: 'hello-plugin.greet',
    name: 'Greet',
    shortcut: 'Ctrl+Shift+G',
    execute: (name: string) => greetCommand(name),
  })

  // 4c. Register search adapter
  ctx.search.register({
    id: 'hello-plugin-search',
    name: 'Hello Search',
    search: helloSearch,
  })

  console.log('[Hello Plugin] Ready — widget + command + search registered')
}

export function unregister(): void {
  console.log('[Hello Plugin] Cleaning up...')
  WidgetRegistry.unregister('hello-plugin-widget')
  console.log('[Hello Plugin] Unregistered')
}
