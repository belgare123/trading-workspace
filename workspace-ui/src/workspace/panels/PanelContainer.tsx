/**
 * PanelContainer — renders a single panel: Toolbar + Tabs + Content
 *
 * Layout:
 *   ┌──────────────────────┐
 *   │ Toolbar (title + actions) │
 *   ├──────────────────────┤
 *   │ Tabs (if multi-tab)  │
 *   ├──────────────────────┤
 *   │ Content (widget)     │
 *   └──────────────────────┘
 *
 * @since 3.2.2
 */

import { PanelToolbar } from './PanelToolbar'
import { PanelTabs } from './PanelTabs'
import type { PanelDefinition, PanelContext } from './PanelDefinition'
import type { ReactNode } from 'react'

export interface PanelContainerProps {
  definition: PanelDefinition
  ctx: PanelContext
}

export function PanelContainer({ definition, ctx }: PanelContainerProps): ReactNode {
  const { panel } = ctx

  return (
    <div
      className="panel-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: 'var(--panel-bg, #1e2028)',
        border: '1px solid var(--panel-border, #2a2d35)',
        borderRadius: 4,
      }}
    >
      {/* Toolbar */}
      <PanelToolbar ctx={ctx} />

      {/* Tabs */}
      <PanelTabs ctx={ctx} />

      {/* Content — render widget */}
      <div
        className="panel-content"
        style={{
          flex: 1,
          overflow: 'hidden',
          display: panel.collapsed ? 'none' : 'block',
        }}
      >
        {panel.minimized ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--muted, #555)',
              fontSize: 12,
            }}
          >
            Panel minimized
          </div>
        ) : (
          definition.render(ctx)
        )}
      </div>
    </div>
  )
}
