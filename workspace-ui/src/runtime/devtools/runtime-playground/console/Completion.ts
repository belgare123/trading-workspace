/**
 * Completion — автодополнение для Service Console
 *
 * @since 2.0.0
 */

export const COMMAND_COMPLETIONS = [
  'market.symbols()',
  'market.price(',
  'market.subscribe(',
  'market.unsubscribe(',
  'portfolio.positions()',
  'portfolio.balance()',
  'strategy.list()',
  'strategy.metrics(',
  'plugin.list()',
  'plugin.install(',
  'ml.models()',
  'ml.predict(',
  'replay.state()',
  'replay.start(',
  'search.index()',
  'search.query(',
]

export function getCompletions(partial: string): string[] {
  if (!partial) return COMMAND_COMPLETIONS
  const lower = partial.toLowerCase()
  return COMMAND_COMPLETIONS.filter((c) => c.toLowerCase().startsWith(lower))
}
