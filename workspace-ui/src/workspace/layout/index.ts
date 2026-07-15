/**
 * index.ts — Layout Engine barrel export
 *
 * @since 3.2.0
 */

export type {
  LayoutId,
  PanelId,
  WidgetRef,
  PanelPosition,
  TabSpec,
  Panel,
  WorkspaceLayout,
  WorkspacePersistenceState,
  PanelContainer,
} from './types'

export {
  LAYOUT_VERSION,
  PERSISTENCE_VERSION,
} from './types'

export {
  createWorkspaceLayout,
  createPanel,
  cloneWorkspaceLayout,
  clonePanel,
  getPanelById,
  addPanel,
  removePanel,
  updatePanelPosition,
  reorderPanels,
} from './WorkspaceLayout'

export {
  LayoutEngine,
  layoutEngine,
} from './LayoutEngine'

export type {
  SplitDirection,
  LayoutChangeHandler,
} from './LayoutEngine'

export {
  LayoutRegistry,
  layoutRegistry,
} from './LayoutRegistry'

export {
  serializeState,
  deserializeState,
  persistState,
  loadPersistedState,
  exportLayout,
  importLayout,
  createDefaultPersistenceState,
} from './LayoutSerializer'

export {
  validateLayout,
} from './LayoutValidator'

export type {
  ValidationIssue,
  ValidationResult,
} from './LayoutValidator'
