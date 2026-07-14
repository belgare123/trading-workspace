/**
 * Workspace SDK — Plugin API for extending the workspace.
 *
 * External plugins can use this module to register:
 *  - Commands
 *  - Search providers (adapters)
 *  - Panels (right-side dock panels)
 *  - Timeline events
 *  - Notification sinks
 *
 * Usage:
 *   import { Workspace } from '../sdk'
 *
 *   Workspace.registerCommand({
 *     id: 'my-plugin.doSomething',
 *     title: 'Do Something',
 *     execute: () => { ... },
 *   })
 *
 *   Workspace.registerSearchAdapter({
 *     id: 'my-data',
 *     title: 'My Data',
 *     domain: 'custom',
 *     search: async (query) => [...],
 *   })
 *
 *   Workspace.registerPanel({
 *     id: 'my-panel',
 *     title: 'My Panel',
 *     render: () => <div>...</div>,
 *   })
 *
 *   Workspace.pushTimelineEvent({
 *     id: 'my-plugin.event-123',
 *     timestamp: Date.now(),
 *     type: 'custom',
 *     title: 'Something happened',
 *   })
 */

export type {
  SdkCommand,
  SdkSearchAdapter,
  SdkPanel,
  SdkTimelineEvent,
  SdkNotification,
} from './types'

export { Workspace } from './workspace'
export { globalPanelRegistry, type PanelRegistration } from './PanelRegistry'
