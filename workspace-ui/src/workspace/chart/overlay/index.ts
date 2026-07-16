// ── Overlay Engine barrel ──
//
// @since 3.3.6

export type { OverlayDefinition } from './OverlayDefinition'
export { OverlayRegistry } from './OverlayRegistry'
export { OverlayInstance } from './OverlayInstance'
export { OverlayRuntime } from './OverlayRuntime'
export { OverlayRenderer } from './OverlayRenderer'
export type { OverlayCategory, OverlayPosition, OverlayRenderContext } from './types'

export { registerAllOverlayBuiltins } from './builtins/index'
