/**
 * useKeyboardBinding — React hook for global keyboard shortcuts
 *
 * Attaches a keydown listener to the window and dispatches
 * matching commands from CommandRegistry.
 *
 * Features:
 *   - Ignores events when focus is inside input/textarea/select
 *   - Prevents default browser behavior for matched shortcuts
 *   - Cleans up on unmount
 *
 * @since 3.2.4
 */

import { useEffect } from 'react'
import type { CommandRegistry } from './CommandRegistry'

export function useKeyboardBinding(registry: CommandRegistry): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Don't intercept when focus is inside editable elements
      const tag = (event.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // Also skip contenteditable elements
      const el = event.target as HTMLElement
      if (el.isContentEditable) return

      const cmd = registry.matchShortcut({
        ctrlKey: event.ctrlKey || event.metaKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        key: event.key,
      })

      if (cmd && (!cmd.canExecute || cmd.canExecute())) {
        event.preventDefault()
        event.stopPropagation()
        cmd.execute()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [registry])
}
