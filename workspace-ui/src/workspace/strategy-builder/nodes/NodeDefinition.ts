// ── NodeDefinition — Abstract base for visual node types ──
//
// UI-only definition class. Implementations provide:
//   createView, render, hitTest, getPorts
//
// No business logic — no evaluate(), execute(), onBar().
//
// @since 3.6.2

import type { StrategyNode } from '../../strategy/composition/types'
import type {
  NodeDefinition as INodeDefinition,
  NodeViewModel,
  NodeRenderContext,
  NodeHitTestResult,
  PortDefinition,
  NodeCategory,
} from './types'

/** Default node dimensions */
const DEFAULT_WIDTH = 180
const DEFAULT_HEIGHT = 80
const HEADER_HEIGHT = 28
const PORT_RADIUS = 5
const PORT_SPACING = 22

export abstract class NodeDefinition implements INodeDefinition {
  abstract id: string
  abstract category: NodeCategory
  abstract typeName: string

  defaultSize: { width: number; height: number } = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }

  abstract createView(node: StrategyNode): NodeViewModel
  abstract getPorts(node: StrategyNode): PortDefinition[]

  /** Default hit-test implementation */
  hitTest(node: NodeViewModel, point: { x: number; y: number }): NodeHitTestResult {
    const { position, size } = node
    const bx = position.x, by = position.y, bw = size.width, bh = size.height

    // Body hit
    if (point.x >= bx && point.x <= bx + bw && point.y >= by && point.y <= by + bh) {
      // Check header
      if (point.y <= by + HEADER_HEIGHT) {
        return { hit: true, part: 'header' }
      }
      // Check ports
      const ports = node.ports
      for (const port of ports) {
        const pp = this._portPosition(node, port)
        const dx = point.x - pp.x, dy = point.y - pp.y
        if (dx * dx + dy * dy <= PORT_RADIUS * PORT_RADIUS + 4) {
          return { hit: true, part: 'port', portId: port.id }
        }
      }
      return { hit: true, part: 'body' }
    }

    // Resize handle (bottom-right corner)
    const handleSize = 10
    if (
      point.x >= bx + bw - handleSize && point.x <= bx + bw + handleSize &&
      point.y >= by + bh - handleSize && point.y <= by + bh + handleSize
    ) {
      return { hit: true, part: 'resize' }
    }

    return { hit: false }
  }

  /** Default render implementation */
  render(context: NodeRenderContext): void {
    const { ctx, node, selected, hovered } = context
    const { position, size, label, ports, collapsed } = node
    const { x, y } = position
    const w = size.width
    const h = collapsed ? HEADER_HEIGHT : size.height

    // ── Shadow ──
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.15)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 2

    // ── Background ──
    ctx.fillStyle = this._getBackgroundColor(node.category)
    ctx.beginPath()
    this._roundRect(ctx, x, y, w, h, 6)
    ctx.fill()

    // ── Shadow reset ──
    ctx.shadowColor = 'transparent'

    // ── Border (selection) ──
    ctx.strokeStyle = selected ? '#4A9EFF' : hovered ? 'rgba(74,158,255,0.4)' : 'rgba(255,255,255,0.1)'
    ctx.lineWidth = selected ? 2 : 1
    ctx.beginPath()
    this._roundRect(ctx, x, y, w, h, 6)
    ctx.stroke()

    // ── Header ──
    const headerBg = selected ? '#2B5F9E' : 'rgba(255,255,255,0.08)'
    ctx.fillStyle = headerBg
    ctx.beginPath()
    this._roundRect(ctx, x, y, w, HEADER_HEIGHT, { tl: 6, tr: 6, bl: 0, br: 0 })
    ctx.fill()

    // ── Label ──
    ctx.fillStyle = '#EAEAEA'
    ctx.font = '600 13px system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x + 12, y + HEADER_HEIGHT / 2)

    // ── Ports ──
    if (!collapsed) {
      for (const port of ports) {
        this._renderPort(ctx, node, port)
      }
    }

    ctx.restore()
  }

  // ── Protected utilities ──

  protected _roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    r: number | { tl: number; tr: number; bl: number; br: number },
  ): void {
    const radii = typeof r === 'number'
      ? { tl: r, tr: r, bl: r, br: r }
      : r
    const { tl, tr, bl, br } = radii
    ctx.moveTo(x + tl, y)
    ctx.lineTo(x + w - tr, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + tr)
    ctx.lineTo(x + w, y + h - br)
    ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h)
    ctx.lineTo(x + bl, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - bl)
    ctx.lineTo(x, y + tl)
    ctx.quadraticCurveTo(x, y, x + tl, y)
    ctx.closePath()
  }

  protected _portPosition(node: NodeViewModel, port: PortDefinition): { x: number; y: number } {
    const { position, size } = node
    const ports = node.ports
    const inputs = ports.filter(p => p.direction === 'input' || p.direction === 'executionInput')
    const outputs = ports.filter(p => p.direction === 'output' || p.direction === 'executionOutput')
    const isInput = port.direction === 'input' || port.direction === 'executionInput'
    const group = isInput ? inputs : outputs
    const idx = group.indexOf(port)

    if (isInput) {
      return { x: position.x, y: position.y + PORT_SPACING * (idx + 0.5) }
    } else {
      return { x: position.x + size.width, y: position.y + PORT_SPACING * (idx + 0.5) }
    }
  }

  protected _renderPort(
    ctx: CanvasRenderingContext2D,
    node: NodeViewModel,
    port: PortDefinition,
  ): void {
    const pos = this._portPosition(node, port)
    const isInput = port.direction === 'input' || port.direction === 'executionInput'

    ctx.fillStyle = isInput ? '#6C8EBF' : '#7CBA6C'
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, PORT_RADIUS, 0, Math.PI * 2)
    ctx.fill()

    // Port label
    ctx.fillStyle = '#9CA3AF'
    ctx.font = '10px system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    const labelX = isInput ? pos.x + 10 : pos.x - 10
    ctx.textAlign = isInput ? 'left' : 'right'
    ctx.fillText(port.name, labelX, pos.y)
  }

  private _getBackgroundColor(category: NodeCategory): string {
    switch (category) {
      case 'signal':    return '#1E3A5F'
      case 'condition': return '#3A2A5F'
      case 'action':    return '#2A5F3A'
      case 'group':     return 'rgba(255,255,255,0.04)'
      case 'comment':   return 'rgba(255,255,0,0.04)'
      case 'entry':     return '#1A1A2E'
      default:          return '#2A2A3E'
    }
  }
}
