/**
 * Panel Registry — lightweight registry for SDK-registered panels.
 */

import type { ReactNode } from 'react'

export interface PanelRegistration {
  id: string
  title: string
  icon?: string
  render: () => ReactNode
  width?: number
}

type PanelListener = (panels: PanelRegistration[]) => void

class PanelRegistryImpl {
  private panels = new Map<string, PanelRegistration>()
  private listeners = new Set<PanelListener>()

  register(panel: PanelRegistration): void {
    if (this.panels.has(panel.id)) {
      console.warn(`[PanelRegistry] Overwriting panel "${panel.id}"`)
    }
    this.panels.set(panel.id, panel)
    this.notify()
  }

  unregister(id: string): void {
    this.panels.delete(id)
    this.notify()
  }

  get(id: string): PanelRegistration | undefined {
    return this.panels.get(id)
  }

  getAll(): PanelRegistration[] {
    return Array.from(this.panels.values())
  }

  onChange(listener: PanelListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    const all = this.getAll()
    for (const listener of this.listeners) {
      listener(all)
    }
  }
}

export const globalPanelRegistry = new PanelRegistryImpl()
