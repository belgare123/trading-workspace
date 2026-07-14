/**
 * Z-index scale. Keeps stacking context predictable.
 */

export const zindex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  backdrop: 300,
  modal: 400,
  toast: 500,
  tooltip: 600,
  popover: 700,
  commandPalette: 800,
} as const

export type ZIndex = keyof typeof zindex
