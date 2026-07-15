/**
 * PanelHost — renders all panels in the current layout
 *
 * PanelHost is the entry point for Panel Runtime rendering.
 * It consumes PanelRuntime (via context), resolves each panel,
 * and renders PanelContainer for each.
 *
 * @since 3.2.2
 */

import { usePanelRuntime } from './PanelContext'
import { PanelContainer } from './PanelContainer'
import type { ReactNode } from 'react'

export function PanelHost(): ReactNode {
  const runtime = usePanelRuntime()
  const resolved = runtime.getResolvedPanels()

  if (resolved.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--muted, #555)',
          fontSize: 14,
        }}
      >
        No panels in the current workspace. Add panels to get started.
      </div>
    )
  }

  return (
    <div
      className="panel-host"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {resolved.map(({ panel, definition }) => {
        if (!definition) {
          return (
            <div
              key={panel.id}
              style={{
                position: 'absolute',
                left: `${panel.position.x * 100}%`,
                top: `${panel.position.y * 100}%`,
                width: `${panel.position.width * 100}%`,
                height: `${panel.position.height * 100}%`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--muted, #555)',
                fontSize: 12,
                border: '1px dashed var(--panel-border, #2a2d35)',
              }}
            >
              Unknown widget: {panel.widgetId}
            </div>
          )
        }

        const ctx = runtime.createPanelContext(panel)

        return (
          <div
            key={panel.id}
            style={{
              position: 'absolute',
              left: `${panel.position.x * 100}%`,
              top: `${panel.position.y * 100}%`,
              width: `${panel.position.width * 100}%`,
              height: `${panel.position.height * 100}%`,
              ...(panel.floating
                ? {
                    zIndex: 100,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  }
                : {}),
            }}
          >
            <PanelContainer definition={definition} ctx={ctx} />
          </div>
        )
      })}
    </div>
  )
}
