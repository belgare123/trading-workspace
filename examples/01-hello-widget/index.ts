/**
 * Hello Widget — Plugin Entry Point
 *
 * Регистрирует минимальный виджет для демонстрации manifest.json + WidgetRegistry.
 *
 * @since 2.0.0
 */

import { WidgetRegistry } from '../../workspace-ui/src/runtime/WidgetRegistry'
import type { WidgetDefinition } from '../../workspace-ui/src/runtime/types'

/**
 * HelloWidget — простой React-компонент для Dashboard.
 * Не использует EventBus, сервисы или внешние данные.
 */
function HelloWidget() {
  return (
    <div style={{
      padding: '16px',
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h2 style={{ margin: '0 0 8px', fontSize: '1.5rem' }}>
        👋 Hello, Runtime!
      </h2>
      <p style={{ margin: 0, color: '#666' }}>
        This widget was registered via <code>WidgetRegistry.register()</code>.
      </p>
    </div>
  )
}

/**
 * WidgetDefinition — все поля, необходимые для регистрации
 */
const helloWidget: WidgetDefinition = {
  id: 'hello-widget',
  name: 'Hello Widget',
  description: 'Minimal dashboard widget',
  category: 'custom',
  defaultSize: { w: 2, h: 2 },
  minSize: { w: 1, h: 1 },
  component: HelloWidget,
}

/**
 * register() — вызывается PluginLoader при активации плагина.
 * Единственное действие: регистрация виджета.
 */
export function register(): void {
  WidgetRegistry.register(helloWidget)
}

/**
 * unregister() — вызывается при деактивации.
 */
export function unregister(): void {
  WidgetRegistry.unregister('hello-widget')
}
