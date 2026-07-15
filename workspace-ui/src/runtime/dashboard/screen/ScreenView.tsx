import type { FC } from 'react'
import { DashboardShell } from '../runtime/DashboardShell'
import type { ScreenEntry } from './ScreenRegistry'

/**
 * ScreenView — renders a ScreenEntry.
 *
 * If the screen has a `preset`, it delegates to DashboardShell.
 * Otherwise the caller must provide a fallback via `children` or handle it externally.
 */
interface ScreenViewProps {
  screen: ScreenEntry
}

export const ScreenView: FC<ScreenViewProps> = ({ screen }) => {
  if (screen.preset) {
    return <DashboardShell preset={screen.preset} />
  }

  // Screen has no preset — the caller must handle via fallback
  return null
}
