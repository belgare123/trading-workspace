/**
 * LayoutValidator — validates layout integrity
 *
 * Checks:
 * - Duplicate panel ids
 * - Overlapping panels
 * - Missing widget refs
 * - Empty panels
 * - Version compatibility
 *
 * @since 3.2.0
 */

import type { WorkspaceLayout, Panel } from './types'
import { LAYOUT_VERSION } from './types'

export interface ValidationIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
  panelId?: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

// ── Overlap detection ──

function panelsOverlap(a: Panel, b: Panel): boolean {
  return (
    a.position.x < b.position.x + b.position.width &&
    a.position.x + a.position.width > b.position.x &&
    a.position.y < b.position.y + b.position.height &&
    a.position.y + a.position.height > b.position.y
  )
}

// ── Validator ──

export function validateLayout(layout: WorkspaceLayout, knownWidgetIds?: Set<string>): ValidationResult {
  const issues: ValidationIssue[] = []
  const seenIds = new Set<string>()

  // Version check
  if (layout.version < 1 || layout.version > LAYOUT_VERSION) {
    issues.push({
      severity: 'warning',
      code: 'LAYOUT_VERSION_MISMATCH',
      message: `Layout version ${layout.version} differs from engine version ${LAYOUT_VERSION}`,
    })
  }

  // Panel-level checks
  for (const panel of layout.panels) {
    // Duplicate id
    if (seenIds.has(panel.id)) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_PANEL_ID',
        message: `Duplicate panel id: ${panel.id}`,
        panelId: panel.id,
      })
    }
    seenIds.add(panel.id)

    // Missing widget ref
    if (!panel.widgetId) {
      issues.push({
        severity: 'error',
        code: 'MISSING_WIDGET_REF',
        message: `Panel '${panel.id}' has no widgetId`,
        panelId: panel.id,
      })
    }

    // Unknown widget ref
    if (knownWidgetIds && panel.widgetId && !knownWidgetIds.has(panel.widgetId)) {
      issues.push({
        severity: 'warning',
        code: 'UNKNOWN_WIDGET_REF',
        message: `Panel '${panel.id}' references unknown widget '${panel.widgetId}'`,
        panelId: panel.id,
      })
    }

    // Negative position/size
    if (panel.position.width <= 0 || panel.position.height <= 0) {
      issues.push({
        severity: 'error',
        code: 'INVALID_PANEL_SIZE',
        message: `Panel '${panel.id}' has non-positive dimensions (${panel.position.width}x${panel.position.height})`,
        panelId: panel.id,
      })
    }

    // Tab refs
    for (const tab of panel.tabs) {
      if (knownWidgetIds && tab.widgetId && !knownWidgetIds.has(tab.widgetId)) {
        issues.push({
          severity: 'warning',
          code: 'UNKNOWN_TAB_WIDGET_REF',
          message: `Tab '${tab.id}' in panel '${panel.id}' references unknown widget '${tab.widgetId}'`,
          panelId: panel.id,
        })
      }
    }
  }

  // Overlap checks (O(n²) — fine for typical workspace sizes)
  for (let i = 0; i < layout.panels.length; i++) {
    for (let j = i + 1; j < layout.panels.length; j++) {
      if (panelsOverlap(layout.panels[i], layout.panels[j])) {
        issues.push({
          severity: 'warning',
          code: 'OVERLAPPING_PANELS',
          message: `Panels '${layout.panels[i].id}' and '${layout.panels[j].id}' overlap`,
          panelId: layout.panels[i].id,
        })
      }
    }
  }

  return {
    valid: issues.every(i => i.severity !== 'error'),
    issues,
  }
}
