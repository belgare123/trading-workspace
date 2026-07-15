/**
 * Plugin Template
 *
 * Start your new Runtime plugin here! Copy this directory, rename, and start coding.
 *
 * @since 2.0.0
 */

import { useState } from 'react'
import { WidgetRegistry } from '../../workspace-ui/src/runtime/WidgetRegistry'
import type { WidgetDefinition } from '../../workspace-ui/src/runtime/types'
import type { PluginContext } from '../../workspace-ui/src/runtime/PluginLoader'
import { runtimeEventBus } from '../../workspace-ui/src/runtime/EventBus'

/* ============================================================
 * 1. Widget Component
 * ============================================================ */

function MyWidget() {
  const [count, setCount] = useState(0)

  return (
    <div style={{
      padding: 16,
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h2>My Plugin</h2>
      <p>My plugin widget</p>
      <p>Counter: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  )
}

const widgetDef: WidgetDefinition = {
  id: 'my-widget',
  name: 'My Widget',
  description: 'Description of my widget',
  category: 'custom',
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 1 },
  component: MyWidget,
}

/* ============================================================
 * 2. Commands
 * ============================================================ */

function myCommand(ctx: PluginContext): void {
  console.log('[My Plugin] Command executed')
  ctx.notifications.send({
    title: 'Hello from My Plugin',
    message: 'Command was executed',
    level: 'info',
    plugin: 'my-plugin',
  })
}

const commands = {
  register: (ctx: PluginContext) => {
    ctx.commands.register({
      id: 'my-plugin.command',
      name: 'My Command',
      execute: () => myCommand(ctx),
    })
  },
}

/* ============================================================
 * 3. Search
 * ============================================================ */

async function mySearch(query: string) {
  return [
    { title: 'My Plugin', description: 'Description of my plugin', type: 'plugin', url: '/my-plugin' },
  ]
}

/* ============================================================
 * 4. register / unregister
 * ============================================================ */

export function register(ctx: PluginContext): WidgetRegistry {
  console.log('[My Plugin] Installing...')

  // register widget
  WidgetRegistry.register(widgetDef)

  // register commands
  commands.register(ctx)

  // register search
  ctx.search.register({
    id: 'my-search',
    name: 'My Search',
    search: mySearch,
  })

  // Example: subscribe to EventBus
  runtimeEventBus.on('runtime.ready', () => {
    console.log('[My Plugin] Runtime is ready!')
  })

  console.log('[My Plugin] Ready')
  return WidgetRegistry
}

export function unregister(): void {
  console.log('[My Plugin] Cleaning up...')
  WidgetRegistry.unregister('my-widget')
  console.log('[My Plugin] Unregistered')
}
