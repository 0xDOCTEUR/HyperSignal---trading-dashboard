/** Résultat d’une course intrabar TP1 vs SL après le bar d’entrée (close = entrée plan). */
export type TpSlRaceOutcome = 'tp1_first' | 'sl_first' | 'timeout'

/**
 * Parcourt les bougies **suivantes** l’entrée (index `entryBarIndex`, entrée = close de ce bar).
 * Dès qu’un niveau est touché sur un bar, il gagne sauf tie sur le même bar.
 *
 * Tie même bar : `sameBarPriority` tranche (en prod on retient en général `stop_first` pour rester prudent).
 */
export function simulateTpSlRace(args: {
  direction: 'long' | 'short'
  highs: number[]
  lows: number[]
  entryBarIndex: number
  stopLoss: number
  takeProfit1: number
  maxBarsForward: number
  sameBarPriority: 'stop_first' | 'tp_first'
}): TpSlRaceOutcome {
  const {
    direction,
    highs,
    lows,
    entryBarIndex,
    stopLoss,
    takeProfit1,
    maxBarsForward,
    sameBarPriority,
  } = args
  const n = highs.length
  if (entryBarIndex < 0 || entryBarIndex >= n) return 'timeout'
  const lastForward = Math.min(entryBarIndex + maxBarsForward, n - 1)
  for (let i = entryBarIndex + 1; i <= lastForward; i++) {
    const hi = highs[i]
    const lo = lows[i]
    if (direction === 'long') {
      const hitSl = lo <= stopLoss
      const hitTp = hi >= takeProfit1
      if (hitSl && hitTp) return sameBarPriority === 'stop_first' ? 'sl_first' : 'tp1_first'
      if (hitSl) return 'sl_first'
      if (hitTp) return 'tp1_first'
    } else {
      const hitSl = hi >= stopLoss
      const hitTp = lo <= takeProfit1
      if (hitSl && hitTp) return sameBarPriority === 'stop_first' ? 'sl_first' : 'tp1_first'
      if (hitSl) return 'sl_first'
      if (hitTp) return 'tp1_first'
    }
  }
  return 'timeout'
}
