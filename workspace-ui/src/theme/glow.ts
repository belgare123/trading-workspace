// Glow tokens — colored radial light effects

export const glow = {
  /** Blue glow — primary accent */
  blue: '0 0 20px rgba(85,125,242,0.15), 0 0 60px rgba(85,125,242,0.05)',
  /** Green glow — success / long */
  green: '0 0 20px rgba(46,189,122,0.15), 0 0 60px rgba(46,189,122,0.05)',
  /** Red glow — danger / short */
  red: '0 0 20px rgba(228,86,106,0.12), 0 0 60px rgba(228,86,106,0.04)',
  /** Purple glow — alternative accent */
  purple: '0 0 20px rgba(155,111,216,0.12), 0 0 60px rgba(155,111,216,0.04)',
  /** Gold glow — warning / opportunity */
  gold: '0 0 20px rgba(212,168,71,0.12), 0 0 60px rgba(212,168,71,0.04)',
  /** Cyan glow — info */
  cyan: '0 0 20px rgba(86,200,216,0.12), 0 0 60px rgba(86,200,216,0.04)',
  /** Soft white glow — subtle highlight */
  white: '0 0 30px rgba(255,255,255,0.04)',
} as const;

export const glowRadial = {
  blue: 'radial-gradient(ellipse at center, rgba(85,125,242,0.08) 0%, transparent 70%)',
  green: 'radial-gradient(ellipse at center, rgba(46,189,122,0.08) 0%, transparent 70%)',
  red: 'radial-gradient(ellipse at center, rgba(228,86,106,0.06) 0%, transparent 70%)',
  purple: 'radial-gradient(ellipse at center, rgba(155,111,216,0.06) 0%, transparent 70%)',
  gold: 'radial-gradient(ellipse at center, rgba(212,168,71,0.06) 0%, transparent 70%)',
} as const;

export type GlowKey = keyof typeof glow;
