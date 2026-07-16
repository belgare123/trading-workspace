// ── VolumeNodesOverlay — HVN/LVN volume nodes on price axis ──
// Renders multiple horizontal segments representing High Volume Nodes (HVN)
// and Low Volume Nodes (LVN) from Market Profile / Volume Profile analysis.
//
// Each node is a short horizontal segment at its price level; HVN nodes
// are thicker to indicate higher activity.
//
// Data shape:
//   nodes: Array<{ price: number; volume: number; type: 'HVN' | 'LVN' }>
//
// @since 3.3.8

import type { OverlayDefinition } from '../../OverlayDefinition'
import type { OverlayInstance } from '../../OverlayInstance'
import type { OverlayRenderContext } from '../../types'

const NODE_LENGTH_PX = 30
const HVN_WIDTH = 3
const LVN_WIDTH = 1
const MAX_VOLUME_SCALE = 60 // px — max segment width when volume scales

interface VolumeNode {
  price: number
  volume: number
  type: 'HVN' | 'LVN'
}

function render(ctx: OverlayRenderContext, inst: OverlayInstance): void {
  const nodes = inst.data.nodes as VolumeNode[] | undefined
  if (!nodes || nodes.length === 0) return

  const { ctx: c, width } = ctx

  c.save()

  // Find max volume for proportional scaling
  let maxVol = 0
  for (const n of nodes) {
    if (n.volume > maxVol) maxVol = n.volume
  }
  if (maxVol === 0) maxVol = 1

  for (const node of nodes) {
    const y = ctx.priceToPixel(node.price)
    if (y < 0 || y > ctx.height) continue

    // Segment length proportional to volume
    const len = Math.max(NODE_LENGTH_PX, (node.volume / maxVol) * MAX_VOLUME_SCALE)

    if (node.type === 'HVN') {
      // HVN — thicker, warmer colour (gold / orange)
      c.strokeStyle = 'rgba(255, 213, 79, 0.8)'
      c.lineWidth = HVN_WIDTH
      c.beginPath()
      c.moveTo(width - len, y)
      c.lineTo(width, y)
      c.stroke()
    } else {
      // LVN — thinner, cooler colour (blue-grey)
      c.strokeStyle = 'rgba(144, 202, 249, 0.5)'
      c.lineWidth = LVN_WIDTH
      c.beginPath()
      c.moveTo(width - len, y)
      c.lineTo(width, y)
      c.stroke()
    }
  }

  c.restore()
}

export const volumeNodesDefinition: OverlayDefinition = {
  id: 'volume-nodes',
  name: 'Volume Nodes',
  category: 'volume',
  render,
}
