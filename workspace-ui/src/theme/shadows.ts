// Shadow tokens — layered depth system

export const shadows = {
  none: 'none',
  /** Small — cards, buttons */
  sm: '0 1px 4px rgba(0,0,0,0.24)',
  /** Default — panels, dropdowns */
  base: '0 2px 8px rgba(0,0,0,0.28)',
  /** Medium — modals, drawers */
  md: '0 4px 16px rgba(0,0,0,0.32)',
  /** Large — dialogs, overlays */
  lg: '0 8px 32px rgba(0,0,0,0.36)',
  /** Extra large — tooltips, popovers */
  xl: '0 12px 48px rgba(0,0,0,0.40)',
  /** Soft glow — elevated glass */
  glow: '0 0 40px rgba(85,125,242,0.08)',
  /** Green glow — positive */
  glowGreen: '0 0 40px rgba(46,189,122,0.08)',
  /** Red glow — negative */
  glowRed: '0 0 40px rgba(228,86,106,0.06)',
  /** Inner shadow for depressed states */
  inner: 'inset 0 1px 2px rgba(0,0,0,0.2)',
} as const;

export type ShadowKey = keyof typeof shadows;
