/**
 * Motion / animation tokens.
 */

export const motion = {
  duration: {
    instant: 50,
    fast: 100,
    normal: 200,
    slow: 300,
    slower: 400,
    slowest: 600,
  },

  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const
