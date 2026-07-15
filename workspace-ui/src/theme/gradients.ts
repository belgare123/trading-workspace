// Gradient tokens — consistent gradient language

export const gradients = {
  /** Primary accent gradient */
  accent: 'linear-gradient(135deg, #3b82f6, #22c55e)',
  /** Accent reverse */
  accentReverse: 'linear-gradient(135deg, #22c55e, #3b82f6)',
  /** Blue to purple */
  cosmic: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  /** Green to cyan */
  oceanic: 'linear-gradient(135deg, #22c55e, #5bc0de)',
  /** Red to orange (danger) */
  fire: 'linear-gradient(135deg, #ef4444, #eab308)',
  /** Gold warm */
  warm: 'linear-gradient(135deg, #eab308, #facc15)',
  /** Purple to cyan */
  aurora: 'linear-gradient(135deg, #8b5cf6, #5bc0de)',
  /** Dark surface gradient */
  surface: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
  /** Surface elevated */
  surfaceElevated: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
  /** Glass shine overlay */
  shine: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 50%, transparent 100%)',
  /** Success green gradient */
  success: 'linear-gradient(135deg, #22c55e, #4ade80)',
  /** Danger red gradient */
  danger: 'linear-gradient(135deg, #ef4444, #f87171)',
  /** Neutral */
  neutral: 'linear-gradient(135deg, #3d4350, #5c6372)',
} as const;

export type GradientKey = keyof typeof gradients;
