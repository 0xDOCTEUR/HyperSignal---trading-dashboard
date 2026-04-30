import { atr, ema, lastNonNull } from './indicators'
import { detectRegime } from './strategies'
import type { PlanTfRow } from '../hooks/usePlanMultiTf'
import { countIntervalsAlignedWithTradeDirection, fetchPlanTfRowsForCoin } from '../hooks/usePlanMultiTf'
import { buildTradePlan, type TradePlan } from './tradePlan'
import type { ScanSignal } from './scanMarket'

/** RR minimum sur le TP principal pour considérer un setup « executable » avec les règles du lab. */
export const MIN_TRADE_RR = 2

/** RR minimal au TP1 pour passer le filtre Opportunités (plus souple que le repère Plan). */
export const SCAN_MIN_RR_AT_TP1 = 1.25

/** Distance min. au mur daily (%) — Opportunités / Plan (zone journalière). */
export const MIN_DAILY_ROOM_PCT = 0.22

/** Alignement minimal sur les 4 UT pyramidales pour lister une opportunité. */
export const SCAN_MIN_MTF_ALIGNED = 2

export interface TradabilityScannerParams {
  equityUsd: number
  riskPct: number
  atrStopFloorMultiple: number
  swingLookback: number
  tpRMultiple1: number
  tpRMultiple2: number
  maxLeverage: number
  minMtfAligned: number
  minDailyRoomPct: number
  /** Seuil RR au premier objectif pour la liste Opportunités (`SCAN_MIN_RR_AT_TP1` en prod). */
  minRrAtTp1: number
}

export interface ScanCandidate {
  signal: ScanSignal
  closes: number[]
  highs: number[]
  lows: number[]
}

export function isDailyWallTooClose(
  direction: 'long' | 'short',
  lastClose: number,
  dailyRow: PlanTfRow | undefined,
  minRoomPct: number
): boolean {
  if (lastClose <= 0 || !dailyRow || dailyRow.error) return false
  const high = dailyRow.recentHigh20
  const low = dailyRow.recentLow20
  if (direction === 'long') {
    if (high == null || high <= lastClose) return false
    const room = ((high - lastClose) / lastClose) * 100
    return room < minRoomPct
  }
  if (low == null || low >= lastClose) return false
  const room = ((lastClose - low) / lastClose) * 100
  return room < minRoomPct
}

/** Vérifie plan numérique + risque levier sans appel réseau. */
export function tradePlanTradableFromOHLC(
  candidate: ScanCandidate,
  params: TradabilityScannerParams
): TradePlan | null {
  const { signal, closes, highs, lows } = candidate
  const n = closes.length
  if (n < 60) return null
  const regime = detectRegime(closes, highs, lows)
  const atrNow = lastNonNull(atr(highs, lows, closes, 14))
  const ema20Now = lastNonNull(ema(closes, 20))
  if (atrNow == null || atrNow <= 0) return null

  const plan = buildTradePlan({
    closes,
    highs,
    lows,
    atr: atrNow,
    ema20: ema20Now,
    direction: signal.direction,
    strategyId: signal.strategyId,
    regime,
    equityUsd: params.equityUsd,
    riskPct: params.riskPct,
    atrStopFloorMultiple: params.atrStopFloorMultiple,
    swingLookback: params.swingLookback,
    tpRMultiple1: params.tpRMultiple1,
    tpRMultiple2: params.tpRMultiple2,
    maxLeverage: params.maxLeverage,
  })

  if (!plan) return null
  if (plan.rrAtTp1 < params.minRrAtTp1) return null
  if (plan.exceedsMaxLeverage) return null
  return plan
}

/** Alignement pyramidale + mur daily une fois le plan numérique validé. */
export function passesTradabilityMtfDailyChecks(
  candidate: ScanCandidate,
  params: TradabilityScannerParams,
  planTfRows: PlanTfRow[]
): boolean {
  const lastClose = candidate.closes[candidate.closes.length - 1]
  const aligned = countIntervalsAlignedWithTradeDirection(planTfRows, candidate.signal.direction)
  if (aligned < params.minMtfAligned) return false

  const dailyRow = planTfRows.find((r) => r.interval === '1d')
  if (isDailyWallTooClose(candidate.signal.direction, lastClose, dailyRow, params.minDailyRoomPct)) {
    return false
  }

  return true
}

/**
 * Opportunité listable : plan OK sur l’UT du scan, alignement multi‑TF, marge vs zone daily.
 * Variante synchrone (lignes MTF déjà chargées ou mockées — backtests / probabilités).
 */
export function assessTradabilityWithRows(
  candidate: ScanCandidate,
  params: TradabilityScannerParams,
  planTfRows: PlanTfRow[]
): boolean {
  const plan = tradePlanTradableFromOHLC(candidate, params)
  if (!plan) return false
  return passesTradabilityMtfDailyChecks(candidate, params, planTfRows)
}

/**
 * Opportunité listable : plan OK sur l’UT du scan, alignement multi‑TF, marge vs zone daily.
 */
export async function assessTradabilityAsync(
  candidate: ScanCandidate,
  params: TradabilityScannerParams
): Promise<boolean> {
  const rows = await fetchPlanTfRowsForCoin(candidate.signal.coin, { preset: 'scan' })
  return assessTradabilityWithRows(candidate, params, rows)
}
