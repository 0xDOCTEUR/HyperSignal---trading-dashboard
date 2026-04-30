import { fetchCandleSnapshot } from './hyperliquid'
import { intervalToMs, type HlInterval } from './interval'
import { atr, ema, lastNonNull } from './indicators'
import { detectRegime, evaluateStrategies } from './strategies'
import { buildTradePlan } from './tradePlan'
import type { MarketTab } from './marketTypes'
import type { ScannerAsset } from './marketTypes'
import { hlOrderPriceString, hlSizeString, clipLeverage } from './hlFormat'
import { candlesToOHLC } from './scanMarket'
import type { ScanSignal } from './scanMarket'

const LOOKBACK_BARS = 380

export interface PinnedTradeSnapshot {
  tab: MarketTab
  coin: string
  direction: 'long' | 'short'
  leverage: number
  strategyName: string
  /** Aligné sur le seuil de score au moment du calcul */
  signalConfirmed: boolean
  entryHl: string
  tpHl: string
  tp2Hl: string
  slHl: string
  sizeHl: string
  pinnedAt: number
}

/** Calcul synchrone à partir de séries OHLC déjà chargées (ex. flux WebSocket). */
export function computePinnedSnapshotFromOHLC(params: {
  tab: MarketTab
  signal: ScanSignal
  asset?: ScannerAsset
  closes: number[]
  highs: number[]
  lows: number[]
  equityUsd: number
  riskPct: number
  atrStopMultiple: number
  swingLookback: number
  tpR1: number
  tpR2: number
  maxLeverageUser: number
}): PinnedTradeSnapshot | null {
  const {
    tab,
    signal,
    asset,
    closes,
    highs,
    lows,
    equityUsd,
    riskPct,
    atrStopMultiple,
    swingLookback,
    tpR1,
    tpR2,
    maxLeverageUser,
  } = params

  if (closes.length < 60) return null

  const regime = detectRegime(closes, highs, lows)
  const { best, bestDirectionalRaw } = evaluateStrategies(closes, highs, lows, regime)
  const chosen = best ?? bestDirectionalRaw
  if (!chosen || chosen.direction === 'flat') return null

  const atrNow = lastNonNull(atr(highs, lows, closes, 14))
  const ema20Now = lastNonNull(ema(closes, 20))
  if (atrNow == null) return null

  const plan = buildTradePlan({
    closes,
    highs,
    lows,
    atr: atrNow,
    ema20: ema20Now,
    direction: chosen.direction,
    strategyId: chosen.id,
    regime,
    equityUsd,
    riskPct,
    atrStopFloorMultiple: atrStopMultiple,
    swingLookback,
    tpRMultiple1: tpR1,
    tpRMultiple2: tpR2,
    maxLeverage: maxLeverageUser,
  })

  if (!plan) return null

  return snapshotFromPlan({
    tab,
    coin: signal.coin,
    strategyName: chosen.name,
    signalConfirmed: best != null,
    asset,
    maxLeverageUser,
    plan,
  })
}

function snapshotFromPlan(params: {
  tab: MarketTab
  coin: string
  strategyName: string
  signalConfirmed: boolean
  asset?: ScannerAsset
  maxLeverageUser: number
  plan: import('./tradePlan').TradePlan
}): PinnedTradeSnapshot {
  const { tab, coin, strategyName, signalConfirmed, asset, maxLeverageUser, plan } =
    params
  const lev = clipLeverage(
    plan.indicativeLeverage,
    maxLeverageUser,
    asset?.maxLeverage
  )
  const szDec = asset?.szDecimals ?? 5
  const isSpot = tab === 'spot'
  const entryPx =
    plan.limitZone != null
      ? (plan.limitZone.low + plan.limitZone.high) / 2
      : plan.entry

  return {
    tab,
    coin,
    direction: plan.direction,
    leverage: lev,
    strategyName,
    signalConfirmed,
    entryHl: hlOrderPriceString(entryPx, szDec, isSpot),
    tpHl: hlOrderPriceString(plan.takeProfit1, szDec, isSpot),
    tp2Hl: hlOrderPriceString(plan.takeProfit2, szDec, isSpot),
    slHl: hlOrderPriceString(plan.stopLoss, szDec, isSpot),
    sizeHl: hlSizeString(plan.sizing.units, szDec),
    pinnedAt: Date.now(),
  }
}

/** Recalcule entrée / TP / SL / taille au format HL pour une paire (après scan ou épingle). */
export async function buildPinnedFromSignal(params: {
  tab: MarketTab
  signal: ScanSignal
  asset?: ScannerAsset
  interval: HlInterval
  equityUsd: number
  riskPct: number
  atrStopMultiple: number
  swingLookback: number
  tpR1: number
  tpR2: number
  maxLeverageUser: number
}): Promise<PinnedTradeSnapshot | null> {
  const {
    tab,
    signal,
    asset,
    interval,
    equityUsd,
    riskPct,
    atrStopMultiple,
    swingLookback,
    tpR1,
    tpR2,
    maxLeverageUser,
  } = params

  const end = Date.now()
  const startTime = end - intervalToMs(interval) * LOOKBACK_BARS

  let candles
  try {
    candles = await fetchCandleSnapshot({
      coin: signal.coin,
      interval,
      startTime,
      endTime: end,
    })
  } catch {
    return null
  }

  const { closes, highs, lows } = candlesToOHLC(candles)
  return computePinnedSnapshotFromOHLC({
    tab,
    signal,
    asset,
    closes,
    highs,
    lows,
    equityUsd,
    riskPct,
    atrStopMultiple,
    swingLookback,
    tpR1,
    tpR2,
    maxLeverageUser,
  })
}
