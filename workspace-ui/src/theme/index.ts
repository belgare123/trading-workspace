// Theme barrel — single import for all theme tokens
export { colors } from './colors';
export type { ColorKey } from './colors';

export { spacing } from './spacing';

export { radius } from './radius';
export type { RadiusKey } from './radius';

export { motion, duration, easing } from './motion';
export type { MotionKey, EasingKey, DurationKey } from './motion';

export { typography, fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, textStyles } from './typography';
export type { TypographyKey } from './typography';

export { glass, glassStyle } from './glass';

export { shadows } from './shadows';
export type { ShadowKey } from './shadows';

export { glow, glowRadial } from './glow';
export type { GlowKey } from './glow';

export { gradients } from './gradients';
export type { GradientKey } from './gradients';

export { iconNames } from './icons';
export type { IconName } from './icons';

export { ThemeProvider, useTheme } from './ThemeProvider';
export type { Theme, ThemeMode } from './ThemeProvider';
