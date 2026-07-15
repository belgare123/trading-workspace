import type { CSSProperties } from 'react';

// Typography scale
export const fontFamily = {
  sans: "'Inter', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  display: "'Inter', system-ui, -apple-system, sans-serif",
} as const;

export const fontSize = {
  '2xs': '0.625rem',   // 10px
  xs: '0.688rem',       // 11px
  sm: '0.75rem',        // 12px
  base: '0.813rem',     // 13px
  md: '0.875rem',       // 14px
  lg: '1rem',           // 16px
  xl: '1.125rem',       // 18px
  '2xl': '1.25rem',     // 20px
  '3xl': '1.5rem',      // 24px
  '4xl': '1.875rem',    // 30px
  '5xl': '2.25rem',     // 36px
  '6xl': '3rem',        // 48px
} as const;

export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

export const lineHeight = {
  tight: 1.15,
  snug: 1.3,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const;

export const letterSpacing = {
  tighter: '-0.02em',
  tight: '-0.01em',
  normal: '0em',
  wide: '0.02em',
  wider: '0.05em',
  widest: '0.1em',
} as const;

export const typography = {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
} as const;

// Preset text styles
export const textStyles = {
  hero: {
    fontSize: fontSize['6xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tighter,
  } as CSSProperties,
  h1: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.tight,
  } as CSSProperties,
  h2: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
  } as CSSProperties,
  h3: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
  } as CSSProperties,
  body: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
  } as CSSProperties,
  bodySm: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
  } as CSSProperties,
  caption: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
  } as CSSProperties,
  label: {
    fontSize: fontSize['2xs'],
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase',
  } as CSSProperties,
  mono: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
  } as CSSProperties,
  numeric: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    fontVariantNumeric: 'tabular-nums',
  } as CSSProperties,
} as const;

export type TypographyKey = keyof typeof typography;
