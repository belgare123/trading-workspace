export const radius = {
  none: '0px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '10px',
  '2xl': '12px',
  '3xl': '16px',
  '4xl': '20px',
  full: '9999px',
} as const;

export type RadiusKey = keyof typeof radius;
