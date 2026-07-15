'use client';

import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react';
import { colors } from './colors';
import { spacing } from './spacing';
import { radius } from './radius';
import { motion } from './motion';
import { typography } from './typography';
import { glass, glassStyle } from './glass';
import { shadows } from './shadows';
import { glow, glowRadial } from './glow';
import { gradients } from './gradients';

export type ThemeMode = 'dark' | 'light';

export interface Theme {
  mode: ThemeMode;
  colors: typeof colors;
  spacing: typeof spacing;
  radius: typeof radius;
  motion: typeof motion;
  typography: typeof typography;
  glass: typeof glass;
  glassStyle: typeof glassStyle;
  shadows: typeof shadows;
  glow: typeof glow;
  glowRadial: typeof glowRadial;
  gradients: typeof gradients;
}

const defaultTheme: Theme = {
  mode: 'dark',
  colors,
  spacing,
  radius,
  motion,
  typography,
  glass,
  glassStyle,
  shadows,
  glow,
  glowRadial,
  gradients,
};

interface ThemeContextValue {
  theme: Theme;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultTheme,
  setMode: () => {},
  toggleMode: () => {},
});

interface ThemeProviderProps {
  children: ReactNode;
  initialMode?: ThemeMode;
}

export function ThemeProvider({ children, initialMode = 'dark' }: ThemeProviderProps) {
  const theme = useMemo(() => ({
    ...defaultTheme,
    mode: initialMode,
  }), [initialMode]);

  const setMode = useCallback((mode: ThemeMode) => {
    document.documentElement.setAttribute('data-theme', mode);
  }, []);

  const toggleMode = useCallback(() => {
    const current = document.documentElement.getAttribute('data-theme') as ThemeMode || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
