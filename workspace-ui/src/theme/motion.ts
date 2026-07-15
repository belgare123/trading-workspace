// Motion tokens — consistent animation language

export const duration = {
  instant: '0ms',
  fast: '100ms',
  normal: '200ms',
  slow: '300ms',
  deliberate: '500ms',
  panel: '700ms',
  page: '1000ms',
} as const;

export const easing = {
  default: 'cubic-bezier(0.16, 1, 0.3, 1)',
  emphasize: 'cubic-bezier(0.32, 0, 0.67, 0)',
  decelerate: 'cubic-bezier(0, 0.55, 0.45, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  bounce: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)',
  linear: 'linear',
} as const;

export const motion = {
  duration,
  easing,
  transition: {
    default: `200ms ${easing.default}`,
    spring: `400ms ${easing.spring}`,
    panel: `500ms ${easing.default}`,
    page: `700ms ${easing.decelerate}`,
  },
} as const;

export type MotionKey = keyof typeof motion;
export type EasingKey = keyof typeof easing;
export type DurationKey = keyof typeof duration;
