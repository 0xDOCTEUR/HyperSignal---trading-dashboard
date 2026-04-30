/**
 * Walk‑forward « Opportunités dashboard » : mesure la fraction TP1 avant SL sur l’historique,
 * avec les **mêmes** filtres scan que `useMarketScanner` + lignes MTF **mockées**
 * (`mockPlanTfRowsPassingTradability`) pour éviter tout appel réseau.
 *
 * Limites :
 * — Pas un oracle : résultats dépendent du jeu OHLC, du RR TP1 et du tie même bar.
 * — Les vraies opportunités utilisent les votes MTF HL ; le mock suppose alignement fort.
 */

import type { HlInterval } from './interval'
import { intervalToMs } from './interval'
import type { TradabilityScannerParams } from './tradability'
import {
  MIN_TRADE_RR,
  SCAN_MIN_MTF_ALIGNED,
  MIN_DAILY_ROOM_PCT,
  SCAN_MIN_RR_AT_TP1,
  passesTradabilityMtfDailyChecks,
  tradePlanTradableFromOHLC,
  type ScanCandidate,
} from './tradability'
import { analyzeCoinSnapshot } from './scanMarket'
import type { TradePlan } from './tradePlan'
import type { PlanTfRow } from '../hooks/usePlanMultiTf'
import { mockPlanTfRowsPassingTradability } from './mockPlanTfRowsForScan'
import { simulateTpSlRace, type TpSlRaceOutcome } from './opportunityOutcomeSimulator'

/** Fenêtre retour journalier équivalente au scanner (`barsWindow`). */
export function barsWindowForDailyReturn(scanInterval: HlInterval): number {
  return Math.max(2, Math.ceil(86_400_000 / intervalToMs(scanInterval)))
}

function tpR2FromTpR1(rr1: number): number {
  return Math.max(rr1 + 0.5, 2.5)
}

/**
 * Aligné sur les constantes fixes dans `App.tsx` (Plan + filtre opportunités par défaut).
 * `tpRMultiple1` correspond au curseur RR TP1 utilisateur (`MIN_TRADE_RR` si non persisté).
 */
export function defaultDashboardTradabilityParams(
  tpRMultiple1: number = MIN_TRADE_RR
): TradabilityScannerParams {
  return {
    equityUsd: 10_000,
    riskPct: 1,
    atrStopFloorMultiple: 2,
    swingLookback: 14,
    tpRMultiple1,
    tpRMultiple2: tpR2FromTpR1(tpRMultiple1),
    maxLeverage: 50,
    minMtfAligned: SCAN_MIN_MTF_ALIGNED,
    minDailyRoomPct: MIN_DAILY_ROOM_PCT,
    minRrAtTp1: SCAN_MIN_RR_AT_TP1,
  }
}

export interface EvaluateDashboardOpportunityOpts {
  coin: string
  closes: number[]
  highs: number[]
  lows: number[]
  vols: number[]
  btcRetWindow: number | null
  barsWindow: number
  /** Même seuil que `useMarketScanner` (`MIN_SCAN_CONFLUENCE_PCT`). */
  minConfluencePct: number
  params: TradabilityScannerParams
  planTfRows: PlanTfRow[]
}

/**
 * Réplique la chaîne locale : confluence scan → `tradePlanTradableFromOHLC` → filtres MTF + daily.
 */
export function evaluateDashboardOpportunityAtBar(o: EvaluateDashboardOpportunityOpts): TradePlan | null {
  const signal = analyzeCoinSnapshot(
    o.coin,
    o.closes,
    o.highs,
    o.lows,
    o.vols,
    o.btcRetWindow,
    o.barsWindow
  )
  if (!signal || signal.confluencePct < o.minConfluencePct) return null
  const candidate: ScanCandidate = { signal, closes: o.closes, highs: o.highs, lows: o.lows }
  const plan = tradePlanTradableFromOHLC(candidate, o.params)
  if (!plan) return null
  if (!passesTradabilityMtfDailyChecks(candidate, o.params, o.planTfRows)) return null
  return plan
}

export interface WalkForwardOpportunityOpts {
  coin: string
  scanInterval: HlInterval
  params: TradabilityScannerParams
  /** Horizon max après le signal (en nombre de bougies UT scan). */
  maxBarsForward: number
  /** Pas entre barres testées (1 = chaque barre). */
  stepBars: number
  minConfluencePct: number
  btcRetWindow: number | null
  sameBarPriority: 'stop_first' | 'tp_first'
  /** Surcharge pour tests ou alignement MTF réel hors‑ligne. */
  planTfRowsFactory?: (direction: 'long' | 'short', lastClose: number) => PlanTfRow[]
}

export interface WalkForwardAggregate {
  evaluatedWindows: number
  /** Fenêtres où un plan opportunité complet est retenu. */
  qualifiedSamples: number
  tp1First: number
  slFirst: number
  timeout: number
  /** `tp1First / qualifiedSamples` */
  empiricalTp1Rate: number | null
  byOutcome: Record<TpSlRaceOutcome, number>
}

const emptyByOutcome = (): Record<TpSlRaceOutcome, number> => ({
  tp1_first: 0,
  sl_first: 0,
  timeout: 0,
})

/**
 * Défile l’historique : à chaque pas, coupe `[0 … t]` et mesure si TP1 ou SL est touché en premier.
 */
export function walkForwardOpportunityHitRates(
  series: { closes: number[]; highs: number[]; lows: number[]; vols: number[] },
  opts: WalkForwardOpportunityOpts
): WalkForwardAggregate {
  const { closes, highs, lows, vols } = series
  const n = closes.length
  const bw = barsWindowForDailyReturn(opts.scanInterval)
  const rowsFactory = opts.planTfRowsFactory ?? mockPlanTfRowsPassingTradability

  let evaluatedWindows = 0
  let qualifiedSamples = 0
  const byOutcome = emptyByOutcome()

  const minWarmup = 60
  const maxStart = n - opts.maxBarsForward - 1
  for (let t = minWarmup; t <= maxStart; t += opts.stepBars) {
    evaluatedWindows++
    const c = closes.slice(0, t + 1)
    const h = highs.slice(0, t + 1)
    const l = lows.slice(0, t + 1)
    const v = vols.slice(0, t + 1)
    const signal = analyzeCoinSnapshot(opts.coin, c, h, l, v, opts.btcRetWindow, bw)
    if (!signal || signal.confluencePct < opts.minConfluencePct) continue
    const planTfRows = rowsFactory(signal.direction, c[c.length - 1])
    const plan = evaluateDashboardOpportunityAtBar({
      coin: opts.coin,
      closes: c,
      highs: h,
      lows: l,
      vols: v,
      btcRetWindow: opts.btcRetWindow,
      barsWindow: bw,
      minConfluencePct: opts.minConfluencePct,
      params: opts.params,
      planTfRows,
    })
    if (!plan) continue
    qualifiedSamples++
    const outcome = simulateTpSlRace({
      direction: plan.direction,
      highs,
      lows,
      entryBarIndex: t,
      stopLoss: plan.stopLoss,
      takeProfit1: plan.takeProfit1,
      maxBarsForward: opts.maxBarsForward,
      sameBarPriority: opts.sameBarPriority,
    })
    byOutcome[outcome]++
  }

  const tp1First = byOutcome.tp1_first
  const slFirst = byOutcome.sl_first
  const timeout = byOutcome.timeout
  const empiricalTp1Rate = qualifiedSamples > 0 ? tp1First / qualifiedSamples : null

  return {
    evaluatedWindows,
    qualifiedSamples,
    tp1First,
    slFirst,
    timeout,
    empiricalTp1Rate,
    byOutcome,
  }
}
