/**
 * LearningModule — stub for the Learning workspace screen.
 *
 * @since 3.1.3.5
 */

import type { ClientModule, RuntimeContext } from '../../modules/types'
import { ScreenRegistry } from '../screen/ScreenRegistry'
import { PresetRegistry } from '../presets/PresetRegistry'
import { BookOpen } from 'lucide-react'

export const LearningModule: ClientModule = {
  id: 'learning',
  name: 'Learning',
  version: '3.1.3',
  description: 'AI/ML: models, training, datasets, experiments, predictions',
  dependsOn: ['workspace-foundation'],

  registerResources(_context: RuntimeContext): void {
    // Resources will be added in Sprint 3.1.6
  },

  registerPresentation(): void {
    PresetRegistry.register({
      id: 'learning',
      title: 'Learning',
      description: 'AI/ML: models, training, datasets, experiments, predictions',
      screens: [{ id: 'learning', title: 'Learning', layout: '2-column', widgets: ['models-list', 'training-status', 'datasets-overview', 'predictions-feed'] }],
    })
    ScreenRegistry.register({ id: 'learning', title: 'Learning', preset: 'learning', icon: BookOpen, category: 'workspace', order: 80 })
  },
}
