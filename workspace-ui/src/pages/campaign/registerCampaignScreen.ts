/**
 * registerCampaignScreen.ts — registers the Campaign screen synchronously
 *
 * Called from App.tsx to ensure the screen appears in the nav on first render.
 */
import { NotebookPen } from 'lucide-react'
import { ScreenRegistry } from '../runtime/dashboard/screen/ScreenRegistry'

export function registerCampaignScreen(): void {
  ScreenRegistry.register({
    id: 'campaign',
    title: 'Campaign',
    preset: undefined,
    icon: NotebookPen,
    category: 'trading',
    order: 55,
  })
}
