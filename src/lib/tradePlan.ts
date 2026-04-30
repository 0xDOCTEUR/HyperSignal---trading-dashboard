import type { Direction, Regime, StrategyId } from './strategies'
import type { Locale } from '../i18n/locale'
import { suggestPositionFromStopDistance } from './sizing'

export interface TradePlan {
  direction: Exclude<Direction, 'flat'>
  /** Référence d’entrée (close dernier — marché synthétique). */
  entry: number
  entryNote: string
  /** Zone alternative pour ordre limite (si applicable). */
  limitZone?: { low: number; high: number }
  stopLoss: number
  takeProfit1: number
  takeProfit2: number
  /** Distance prix entrée → SL (toujours positive). */
  riskDistance: number
  rewardMultiple1: number
  rewardMultiple2: number
  /** Risque / récompense jusqu’à TP1 et TP2 (depuis entrée). */
  rrAtTp1: number
  rrAtTp2: number
  sizing: {
    riskUsd: number
    units: number
    notionalUsd: number
  }
  /** Notional / equity — approximation grossière si tout le collatéral est utilisé. */
  indicativeLeverage: number
  /** Si levier indicatif dépasse le plafond utilisateur. */
  exceedsMaxLeverage: boolean
  /** Levier max pour que notional ≈ equity × levier (approx.). */
  maxLeverageInput: number
  structuralLevel: number
  warnings: string[]
}

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

/**
 * Proposition mécanique entrée / SL / TP / taille / levier indicatif.
 * Pas une optimisation du marché — règles fixes ATR + swings récents.
 */
export function buildTradePlan(params: {
  closes: number[]
  highs: number[]
  lows: number[]
  atr: number
  ema20: number | null
  direction: Exclude<Direction, 'flat'>
  strategyId: StrategyId
  regime: Regime | null
  equityUsd: number
  riskPct: number
  atrStopFloorMultiple: number
  swingLookback: number
  tpRMultiple1: number
  tpRMultiple2: number
  maxLeverage: number
  locale?: Locale
}): TradePlan | null {
  const {
    closes,
    highs,
    lows,
    atr,
    ema20,
    direction,
    strategyId,
    regime,
    equityUsd,
    riskPct,
    atrStopFloorMultiple,
    swingLookback,
    tpRMultiple1,
    tpRMultiple2,
    maxLeverage,
    locale = 'fr',
  } = params

  const n = closes.length
  if (n < swingLookback + 2 || atr <= 0 || equityUsd <= 0 || riskPct <= 0) return null

  const entry = closes[n - 1]
  const warnings: string[] = []

  const volBump = regime?.label === 'volatile' ? 1.12 : 1
  const atrFloor = atr * atrStopFloorMultiple * volBump

  let structuralLevel: number
  let riskDistance: number
  let stopLoss: number
  let takeProfit1: number
  let takeProfit2: number

  const buf = atr * 0.12

  if (direction === 'long') {
    const swingLow = minRecent(lows, n - 1, swingLookback)
    structuralLevel = swingLow - buf
    let dStruct = entry - structuralLevel
    if (dStruct <= 0) {
      dStruct = atrFloor
      warnings.push(
        locale === 'en'
          ? 'Recent swing above price: fallback stop distance uses ATR floor only.'
          : 'Swing récent au-dessus du prix : fallback distance stop sur plancher ATR uniquement.'
      )
    }
    riskDistance = Math.max(dStruct, atrFloor)
    stopLoss = entry - riskDistance
    takeProfit1 = entry + tpRMultiple1 * riskDistance
    takeProfit2 = entry + tpRMultiple2 * riskDistance
  } else {
    const swingHigh = maxRecent(highs, n - 1, swingLookback)
    structuralLevel = swingHigh + buf
    let dStruct = structuralLevel - entry
    if (dStruct <= 0) {
      dStruct = atrFloor
      warnings.push(
        locale === 'en'
          ? 'Recent swing below price: fallback stop distance uses ATR floor only.'
          : 'Swing récent sous le prix : fallback distance stop sur plancher ATR uniquement.'
      )
    }
    riskDistance = Math.max(dStruct, atrFloor)
    stopLoss = entry + riskDistance
    takeProfit1 = entry - tpRMultiple1 * riskDistance
    takeProfit2 = entry - tpRMultiple2 * riskDistance
  }

  const rrAtTp1 = riskDistance > 0 ? (Math.abs(takeProfit1 - entry) / riskDistance) : 0
  const rrAtTp2 = riskDistance > 0 ? (Math.abs(takeProfit2 - entry) / riskDistance) : 0

  const sizingCore = suggestPositionFromStopDistance({
    equityUsd,
    riskPct,
    entryPrice: entry,
    stopDistancePrice: riskDistance,
  })
  if (!sizingCore) return null

  const indicativeLeverage =
    equityUsd > 0 ? sizingCore.notionalUsd / equityUsd : 0
  const exceedsMaxLeverage = indicativeLeverage > maxLeverage + 1e-6

  if (riskDistance / entry > 0.06) {
    warnings.push(
      locale === 'en'
        ? 'Very wide stop vs price (> ~6%): small size or very volatile market.'
        : 'Stop très large vs prix (> ~6 %) : taille petite ou marché très volatile.'
    )
  }
  if (indicativeLeverage > maxLeverage) {
    warnings.push(
      locale === 'en'
        ? `Indicative leverage (${indicativeLeverage.toFixed(2)}×) exceeds your cap (${maxLeverage}×). Reduce risk %, increase equity or widen stop per your tolerance.`
        : `Levier indicatif (${indicativeLeverage.toFixed(2)}×) dépasse ton plafond (${maxLeverage}×). Réduis risque %, augmente equity ou élargis stop selon ta tolérance.`
    )
  }

  let entryNote =
    locale === 'en'
      ? `Reference entry = last close (${strategyId}).`
      : `Entrée de référence = dernier close (${strategyId}).`
  let limitZone: { low: number; high: number } | undefined

  if (strategyId === 'trend_ema_macd' && ema20 != null) {
    entryNote =
      locale === 'en'
        ? 'Trend: market entry at last close or limit pullback toward EMA20 if you filter for cleaner structure.'
        : 'Tendance : entrée marché au dernier close ou pullback limite vers EMA20 si tu filtres une meilleure structure.'
    const band = atr * 0.08
    limitZone = { low: ema20 - band, high: ema20 + band }
  } else if (strategyId === 'mean_reversion_rsi') {
    entryNote =
      locale === 'en'
        ? 'Mean reversion: often market execution after signal; check candle confirmation.'
        : 'Mean-reversion : souvent exécution au marché après signal ; vérifie si la bougie confirme.'
  } else if (strategyId === 'breakout_range') {
    entryNote =
      locale === 'en'
        ? 'Breakout: continuation beyond the broken level; current close as proxy.'
        : 'Breakout : continuation au-dessous/dessus du niveau cassé ; close actuel comme proxy.'
  }

  return {
    direction,
    entry,
    entryNote,
    limitZone,
    stopLoss,
    takeProfit1,
    takeProfit2,
    riskDistance,
    rewardMultiple1: tpRMultiple1,
    rewardMultiple2: tpRMultiple2,
    rrAtTp1,
    rrAtTp2,
    sizing: {
      riskUsd: sizingCore.riskUsd,
      units: sizingCore.units,
      notionalUsd: sizingCore.notionalUsd,
    },
    indicativeLeverage,
    exceedsMaxLeverage,
    maxLeverageInput: maxLeverage,
    structuralLevel,
    warnings,
  }
}
