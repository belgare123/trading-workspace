/**
 * PanelToolbar — panel header with title and action buttons
 *
 * @since 3.2.2
 */

import type { PanelContext } from './PanelDefinition'

export interface PanelToolbarProps {
  ctx: PanelContext
  /** Override actions (e.g. hide close on pinned panels) */
  actions?: PanelToolbarActions
}

export interface PanelToolbarActions {
  showClose?: boolean
  showFloat?: boolean
  showPin?: boolean
  showCollapse?: boolean
  showMinimize?: boolean
  showMaximize?: boolean
}

const defaultActions: PanelToolbarActions = {
  showClose: true,
  showFloat: true,
  showPin: true,
  showCollapse: true,
  showMinimize: true,
  showMaximize: false,
}

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  padding: '2px 6px',
  fontSize: '11px',
  lineHeight: 1,
  opacity: 0.6,
}

export function PanelToolbar({ ctx, actions: overrides }: PanelToolbarProps): React.ReactElement {
  const actions = { ...defaultActions, ...overrides }
  const { panel, actions: panelActions } = ctx

  const handleDoubleClick = () => {
    if (panel.floating) {
      panelActions.pin()
    } else {
      panelActions.float()
    }
  }

  return (
    <div
      className="panel-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '2px 4px',
        background: 'var(--panel-header-bg, #1a1d23)',
        borderBottom: '1px solid var(--panel-border, #2a2d35)',
        userSelect: 'none',
        cursor: 'grab',
        minHeight: 28,
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Title */}
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--panel-header-fg, #c0c4cc)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {panel.title}
      </span>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
        {actions.showMinimize && (
          <button
            style={btnStyle}
            title="Minimize"
            onClick={e => { e.stopPropagation(); panelActions.minimize() }}
          >
            _
          </button>
        )}
        {actions.showCollapse && (
          <button
            style={btnStyle}
            title={panel.collapsed ? 'Expand' : 'Collapse'}
            onClick={e => { e.stopPropagation(); panelActions.collapse() }}
          >
            {panel.collapsed ? '□' : '−'}
          </button>
        )}
        {actions.showFloat && (
          <button
            style={btnStyle}
            title={panel.floating ? 'Dock' : 'Float'}
            onClick={e => { e.stopPropagation(); panelActions.float() }}
          >
            ◇
          </button>
        )}
        {actions.showPin && (
          <button
            style={{
              ...btnStyle,
              opacity: panel.pinned ? 1 : 0.4,
            }}
            title={panel.pinned ? 'Unpin' : 'Pin'}
            onClick={e => { e.stopPropagation(); panelActions.pin() }}
          >
            📌
          </button>
        )}
        {actions.showMaximize && (
          <button
            style={btnStyle}
            title="Maximize"
            onClick={e => { e.stopPropagation(); panelActions.maximize() }}
          >
            ⛶
          </button>
        )}
        {!panel.pinned && actions.showClose && (
          <button
            style={{ ...btnStyle, fontSize: 13 }}
            title="Close"
            onClick={e => { e.stopPropagation(); panelActions.close() }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
