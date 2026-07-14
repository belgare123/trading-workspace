/**
 * Color tokens for the Workspace Design System.
 *
 * All UI colors come from this single source. Never use raw hex values
 * outside legacy inline styles — migrate those as components are touched.
 */

export const colors = {
  // Background hierarchy
  surface: {
    DEFAULT: '#0d0d0f',       // page / root background
    raised: '#181a1e',        // card / panel background
    overlay: '#1e1f23',       // hover / elevated
    toolbar: '#1a1b1e',      // top toolbar
    sidebar: '#141517',      // nav sidebar
    input: '#1e2026',        // text input / search
    status: '#0d0d0f',       // bottom status bar
  },

  // Border
  border: {
    DEFAULT: '#25282e',      // default border
    subtle: '#2c2e33',       // lighter border
    hover: '#373a40',        // hovered border
  },

  // Text
  text: {
    primary: '#e4e8ee',
    secondary: '#c8cdd5',
    muted: '#8892a4',
    dim: '#5b6a7a',
    disabled: '#4a4d55',
  },

  // Accent / brand
  accent: {
    blue: '#5b8def',
    blueHover: '#4c7de0',
    cyan: '#22b8cf',
    purple: '#9775fa',
  },

  // Semantic
  success: {
    DEFAULT: '#22c55e',
    bg: '#14532d33',
    text: '#4ade80',
  },

  warning: {
    DEFAULT: '#f59e0b',
    bg: '#5c3c0a33',
    text: '#fbbf24',
  },

  danger: {
    DEFAULT: '#ef4444',
    bg: '#5c1a1a33',
    text: '#f87171',
  },

  info: {
    DEFAULT: '#3b82f6',
    bg: '#1e3a5f33',
  },

  // Chart / trading
  chart: {
    up: '#22c55e',
    down: '#ef4444',
    neutral: '#5b8def',
    volume: '#5b8def55',
    grid: '#1e2026',
  },

  // Overlay / backdrop
  backdrop: '#00000066',
  scrollbar: '#373a40',
}

export type ThemeColors = typeof colors
