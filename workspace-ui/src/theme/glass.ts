// Glass effect tokens — frosted glass aesthetic

export const glass = {
  /** Glass surface opacity — light */
  light: {
    background: 'rgba(255,255,255,0.03)',
    border: 'rgba(255,255,255,0.06)',
    blur: '12px',
    saturation: '1.4',
  },
  /** Glass surface opacity — medium */
  medium: {
    background: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.08)',
    blur: '20px',
    saturation: '1.6',
  },
  /** Glass surface opacity — heavy */
  heavy: {
    background: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.12)',
    blur: '32px',
    saturation: '1.8',
  },
  /** Colored glass variants */
  tinted: {
    blue: {
      background: 'rgba(85,125,242,0.06)',
      border: 'rgba(85,125,242,0.12)',
      blur: '16px',
    },
    green: {
      background: 'rgba(46,189,122,0.06)',
      border: 'rgba(46,189,122,0.12)',
      blur: '16px',
    },
    purple: {
      background: 'rgba(155,111,216,0.06)',
      border: 'rgba(155,111,216,0.12)',
      blur: '16px',
    },
  },
} as const;

export const glassStyle = (variant: keyof typeof glass | 'light' = 'light') => {
  const g = variant === 'light' ? glass.light
    : variant === 'medium' ? glass.medium
    : variant === 'heavy' ? glass.heavy
    : glass.light;

  return {
    background: g.background,
    backdropFilter: `blur(${g.blur}) saturate(${g.saturation})`,
    WebkitBackdropFilter: `blur(${g.blur}) saturate(${g.saturation})`,
    border: `1px solid ${g.border}`,
  } as const;
};
