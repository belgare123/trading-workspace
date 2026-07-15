/**
 * PanelTabs — tab bar for panels with multiple tabs
 *
 * @since 3.2.2
 */

import type { PanelContext } from './PanelDefinition'

export interface PanelTabsProps {
  ctx: PanelContext
}

const tabBase: React.CSSProperties = {
  padding: '3px 12px',
  fontSize: 11,
  cursor: 'pointer',
  border: 'none',
  color: 'var(--panel-tab-fg, #888)',
  background: 'transparent',
  position: 'relative',
  whiteSpace: 'nowrap',
}

const activeTabStyle: React.CSSProperties = {
  ...tabBase,
  color: 'var(--panel-tab-active-fg, #e0e0e0)',
  borderBottom: '2px solid var(--accent, #4a9eff)',
}

export function PanelTabs({ ctx }: PanelTabsProps): React.ReactElement | null {
  const { panel } = ctx

  if (!panel.tabs || panel.tabs.length === 0) return null

  return (
    <div
      className="panel-tabs"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        background: 'var(--panel-tabs-bg, #14171c)',
        borderBottom: '1px solid var(--panel-border, #2a2d35)',
        paddingLeft: 4,
        overflowX: 'auto',
        scrollbarWidth: 'thin',
      }}
    >
      {panel.tabs.map(tab => (
        <button
          key={tab.id}
          style={panel.activeTab === tab.id ? activeTabStyle : tabBase}
          onClick={() => { /* activateTab handled by parent */ }}
          title={tab.icon || undefined}
        >
          {tab.title}
        </button>
      ))}
    </div>
  )
}
