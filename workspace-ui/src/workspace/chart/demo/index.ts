/**
 * index.ts — Chart Sandbox barrel
 *
 * @since 3.3.2
 */

export { ChartDemoPage, ChartSandboxStandalone } from './ChartDemoPage'
export { ChartDemoToolbar } from './ChartDemoToolbar'
export { MockCandleProvider, useSandbox } from './MockCandleProvider'
export type { SandboxState, SandboxSymbol, SandboxTimeframe } from './MockCandleProvider'
export { generateCandles } from './generateCandles'
export type { GenerateOptions } from './generateCandles'
