// ── AveragePrice — Average price calculation helpers ──
//
// @since 3.5.1

/** Calculate weighted average of an array of prices and quantities */
export function weightedAveragePrice(
  entries: { price: number; quantity: number }[],
): number {
  const totalValue = entries.reduce((sum, e) => sum + e.price * e.quantity, 0)
  const totalQty = entries.reduce((sum, e) => sum + e.quantity, 0)
  return totalQty > 0 ? totalValue / totalQty : 0
}

/** Calculate total cost including commission */
export function totalCost(
  quantity: number,
  price: number,
  commission: number,
): number {
  return quantity * price + commission
}

/** Calculate entry cost for scaling a position */
export function scaledEntryCost(
  currentQty: number,
  currentAvg: number,
  addQty: number,
  addPrice: number,
): number {
  return (currentQty * currentAvg + addQty * addPrice) / (currentQty + addQty)
}
