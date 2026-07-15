/* ═══════════════════════════════════════════════════════════════
   StatusBadge — единый словарь статусов
   Spec: Workspace_UI_Architecture_v2.md §3.2
   ═══════════════════════════════════════════════════════════════ */

import type { RuntimeStatus } from '../widgets/types'
import { STATUS_COLORS } from '../widgets/types'

interface StatusBadgeProps {
  status: RuntimeStatus
  label?: string
  size?: 'sm' | 'md'
  pulse?: boolean
}

export function StatusBadge({ status, label, size = 'sm', pulse }: StatusBadgeProps) {
  const color = STATUS_COLORS[status]
  const dotSize = size === 'sm' ? 6 : 8
  const fontSize = size === 'sm' ? 11 : 13

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize,
        fontWeight: 500,
        color,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span
        className={pulse ? 'pulse-dot' : ''}
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      {label ?? status}
    </span>
  )
}
