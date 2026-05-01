import type { HlCandle } from './hyperliquid'

function utcMonthKey(tMs: number): string {
  const d = new Date(tMs)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Reconstruit des OHLC mensuels (mois calendaire UTC) a partir des bougies 1d.
 * Hyperliquid renvoie souvent tres peu de bougies natives `1M` ; le journalier
 * dispose en general de plusieurs annees d'historique.
 */
export function aggregateDailyCandlesToMonthlyOhlc(candles: HlCandle[]): {
  highs: number[]
  lows: number[]
  closes: number[]
  opens: number[]
} {
  if (candles.length === 0) return { highs: [], lows: [], closes: [], opens: [] }

  const sorted = [...candles].sort((a, b) => a.t - b.t)
  type Acc = { highs: number[]; lows: number[]; firstO: number; lastC: number }
  const map = new Map<string, Acc>()

  for (const c of sorted) {
    const k = utcMonthKey(c.t)
    let b = map.get(k)
    if (!b) {
      b = { highs: [c.h], lows: [c.l], firstO: c.o, lastC: c.c }
      map.set(k, b)
    } else {
      b.highs.push(c.h)
      b.lows.push(c.l)
      b.lastC = c.c
    }
  }

  const keys = [...map.keys()].sort()
  const opens: number[] = []
  const highs: number[] = []
  const lows: number[] = []
  const closes: number[] = []

  for (const k of keys) {
    const b = map.get(k)!
    opens.push(b.firstO)
    highs.push(Math.max(...b.highs))
    lows.push(Math.min(...b.lows))
    closes.push(b.lastC)
  }

  return { opens, highs, lows, closes }
}
