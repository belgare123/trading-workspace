// Trading Workspace — Design Token Colors
// Inspired by Linear, Bloomberg Terminal, TradingView dark

export const colors = {
  // Surfaces
  surface: {
    0: '#05070a',
    1: '#0b0e14',
    2: '#111620',
    3: '#151c28',
    4: '#1a2232',
    hover: '#202838',
  },

  // Borders
  border: {
    subtle: 'rgba(255,255,255,0.04)',
    base: 'rgba(255,255,255,0.06)',
    accent: 'rgba(255,255,255,0.10)',
    strong: 'rgba(255,255,255,0.16)',
  },

  // Text
  text: {
    primary: '#f0f2f5',
    secondary: '#949aa8',
    tertiary: '#5c6372',
    muted: '#3d4350',
    inverse: '#05070a',
    link: '#3b82f6',
  },

  // Accent — blue
  accent: {
    blue: '#3b82f6',
    blueHover: '#60a5fa',
    blueBg: 'rgba(59,130,246,0.12)',
    purple: '#8b5cf6',
    purpleHover: '#a78bfa',
    purpleBg: 'rgba(139,92,246,0.12)',
    cyan: '#5bc0de',
    cyanHover: '#6dd4f0',
    cyanBg: 'rgba(91,192,222,0.12)',
  },

  // Semantic
  semantic: {
    success: '#22c55e',
    successBg: 'rgba(34,197,94,0.12)',
    successText: '#4ade80',
    warning: '#eab308',
    warningBg: 'rgba(234,179,8,0.12)',
    warningText: '#facc15',
    danger: '#ef4444',
    dangerBg: 'rgba(239,68,68,0.12)',
    dangerText: '#f87171',
    info: '#3b82f6',
    infoBg: 'rgba(59,130,246,0.12)',
    infoText: '#60a5fa',
  },

  // Chart
  chart: {
    green: '#22c55e',
    red: '#ef4444',
    volume: 'rgba(255,255,255,0.04)',
    grid: 'rgba(255,255,255,0.04)',
    crosshair: 'rgba(255,255,255,0.20)',
    areaUp: 'rgba(34,197,94,0.08)',
    areaDown: 'rgba(239,68,68,0.08)',
  },

  // Glass
  glass: {
    white: 'rgba(255,255,255,0.03)',
    whiteStrong: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.06)',
  },
} as const;

export type ColorKey = keyof typeof colors;
