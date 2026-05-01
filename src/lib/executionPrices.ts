/**
 * Limit buy / sell levels from the same OHLC horizon as the plan (swing + ATR margin).
 * Swings exclude the current (forming) candle, matching tradePlan rules.
 */

function minRecent(lows: number[], endExclusive: number, lookback: number): number {
  const start = Math.max(0, endExclusive - lookback)
  let m = lows[start]
  for (let j = start + 1; j < endExclusive; j++) m = Math.min(m, lows[j])
  return m
}

function maxRecent(highs: number[], endExclusive: number, lookback: number): number {
  const start = Math.max(0, endExclusive - lookback)
  let m = highs[start]
  for (let j = start + 1; j < endExclusive; j++) m = Math.max(m, highs[j])
  return m
}

export interface ExecutionPriceHints {
  /** Favorable limit buy: near recent range low. */
  buyLimitPrice: number
  /** Favorable limit sell: near recent range high. */
  sellLimitPrice: number
  swingLow: number
  swingHigh: number
}

export function computeExecutionPriceHints(params: {
  highs: number[]
  lows: number[]
  closes: number[]
  atr: number
  swingLookback: number
}): ExecutionPriceHints | null {
  const { highs, lows, closes, atr, swingLookback } = params
  const n = closes.length
  if (n < swingLookback + 2 || atr <= 0) return null

  const swingLow = minRecent(lows, n - 1, swingLookback)
  const swingHigh = maxRecent(highs, n - 1, swingLookback)
  const edge = Math.max(atr * 0.12, Math.abs(closes[n - 1] ?? 0) * 1e-10)

  let buyLimitPrice = swingLow + edge
  let sellLimitPrice = swingHigh - edge

  if (!Number.isFinite(buyLimitPrice) || !Number.isFinite(sellLimitPrice)) return null

  if (buyLimitPrice >= sellLimitPrice) {
    buyLimitPrice = swingLow
    sellLimitPrice = swingHigh
  }

  return { buyLimitPrice, sellLimitPrice, swingLow, swingHigh }
}
