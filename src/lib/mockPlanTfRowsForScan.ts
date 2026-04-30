import type { PlanTfRow } from '../hooks/usePlanMultiTf'
import { PLAN_COMPARE_TF } from '../hooks/usePlanMultiTf'
import type { StrategyVote } from './strategies'

/** ≥ MIN_DAILY_ROOM_PCT (0,22 %) au‑delà du close pour la jambe favorable au mur daily. */
const MIN_ROOM_FRAC_FOR_LONG = 0.004
const MIN_ROOM_FRAC_FOR_SHORT = 0.004

const stubVote = (direction: 'long' | 'short'): StrategyVote => ({
  id: 'trend_ema_macd',
  name: 'Trend EMA/MACD',
  direction,
  rawScore: 0.5,
  regimeFit: 1,
  weighted: 0.5,
  reasons: [],
})

/**
 * Lignes MTF fictives qui satisfont `countIntervalsAlignedWithTradeDirection`
 * et la marge vs mur daily (`recentHigh20` / `recentLow20`).
 *
 * À utiliser uniquement pour backtests / tests — le dashboard réel appelle l’API HL.
 */
export function mockPlanTfRowsPassingTradability(
  direction: 'long' | 'short',
  lastClose: number
): PlanTfRow[] {
  return PLAN_COMPARE_TF.map((interval) => {
    const hi =
      direction === 'long'
        ? lastClose * (1 + MIN_ROOM_FRAC_FOR_LONG + 0.02)
        : lastClose * 1.004
    const lo =
      direction === 'short'
        ? lastClose * (1 - MIN_ROOM_FRAC_FOR_SHORT - 0.02)
        : lastClose * 0.996
    return {
      interval,
      bars: 96,
      ret24hPct: null,
      ret7dPct: null,
      regime: null,
      regimeLabel: '—',
      regimeExplanation: null,
      bestVote: stubVote(direction),
      confirmedStrong: true,
      rsi: null,
      atrOverPricePct: null,
      emaStructure: '—',
      macdHint: '—',
      lastClose,
      ema20: null,
      ema50: null,
      longShortNeutral: '—',
      directionalSkew: null,
      votes: [],
      recentHigh20: hi,
      recentLow20: lo,
    }
  })
}
