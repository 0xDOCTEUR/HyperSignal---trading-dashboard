import type { Locale } from '../i18n/locale'
import { atr, ema, lastNonNull, macd, rsi } from './indicators'
import type { HlInterval } from './interval'

/** Investissement pur LT : bougies mensuelles uniquement (cycles pluri-annuels). */
export const INVESTOR_PURE_LT_INTERVAL = '1M' as const satisfies HlInterval

/** Au moins 1 mois aggrege : une reponse est renvoyee (mode limite si < 20 mois). */
export const INVESTOR_LT_MIN_MONTHLY_CLOSES = 1

/**
 * Seuil du mode complet (EMA20/MM longues, RSI/MACD mensuels fiables en fin de serie).
 */
export const INVESTOR_MIN_MONTHLY_CLOSES = 20

/** Bar count where full slow EMA(50) + optional EMA100 in buy base applies. */
export const INVESTOR_MONTHLY_FULL_SLOW_PERIOD = 50

/** Monthly closes needed to include EMA100 in buy base (~9y). */
export const INVESTOR_MONTHLY_BARS_FOR_EMA100 = 110

/** Daily 1d bars to fetch (useHlCandles spans min(bars+50, 5000) days, ~13.7y cap). */
export const INVESTOR_LT_DAILY_FETCH_BARS = 4500

const SWING_MONTHLY = 12
const N_FULL_MONTHLY = INVESTOR_MONTHLY_BARS_FOR_EMA100

function monthlySlowEmaPeriod(n: number): number {
  if (n >= INVESTOR_MONTHLY_FULL_SLOW_PERIOD) return 50
  if (n >= 34) return 34
  if (n >= 26) return 26
  return 20
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

export interface LongTermStrategyZone {
  low: number
  high: number
  coherencePct: number
  detailFr: string[]
  detailEn: string[]
}

export interface LongTermPerformanceGauge {
  score0to100: number
  structuralRunPct: number | null
  indicativeRr: number | null
  executionRunPct: number | null
}

export type LtRiskTier = 'low' | 'moderate' | 'high'

export interface LtRiskEstimate {
  /** Volatilite annualisee approx. (rendements log mensuels * sqrt(12)), % ; null si 1 mois. */
  volAnnualizedPct: number | null
  /** Drawdown max sur la serie de clots mensuels, % (valeur <= 0). */
  maxDrawdownPct: number | null
  tier: LtRiskTier
}

export interface PureLongTermStrategyResult {
  interval: typeof INVESTOR_PURE_LT_INTERVAL
  /** Nombre de mois (OHLC synthetiques) utilises. */
  historyMonths: number
  /** Complet = indicateurs mensuels classiques ; limite = enveloppe courte + ATR reduit. */
  mode: 'full' | 'limited'
  lastClose: number
  atr: number
  buyZone: LongTermStrategyZone
  sellZone: LongTermStrategyZone
  performance: LongTermPerformanceGauge
  /** Heuristique sur l'historique mensuel synthetique uniquement. */
  risk: LtRiskEstimate
}

export function computeLtRiskFromMonthlyCloses(closes: number[]): LtRiskEstimate {
  const n = closes.length
  if (n < 2) {
    return { volAnnualizedPct: null, maxDrawdownPct: null, tier: 'moderate' }
  }

  const rets: number[] = []
  for (let i = 1; i < n; i++) {
    const a = closes[i - 1]
    const b = closes[i]
    if (a > 0 && b > 0) rets.push(Math.log(b / a))
  }
  if (rets.length === 0) {
    return { volAnnualizedPct: null, maxDrawdownPct: null, tier: 'moderate' }
  }

  const mean = rets.reduce((s, x) => s + x, 0) / rets.length
  const nR = rets.length
  const variance =
    nR > 1 ? rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (nR - 1) : 0
  const monthVol = Math.sqrt(Math.max(0, variance))
  const volAnnualizedPct = monthVol * Math.sqrt(12) * 100

  let peak = closes[0]
  let maxDD = 0
  for (const c of closes) {
    if (c > peak) peak = c
    if (peak > 0) {
      const dd = (c - peak) / peak
      if (dd < maxDD) maxDD = dd
    }
  }
  const maxDrawdownPct = maxDD * 100

  let tier: LtRiskTier = 'moderate'
  if (volAnnualizedPct >= 85 || maxDrawdownPct <= -72) tier = 'high'
  else if (volAnnualizedPct <= 42 && maxDrawdownPct >= -38) tier = 'low'

  return {
    volAnnualizedPct: Number.isFinite(volAnnualizedPct) ? volAnnualizedPct : null,
    maxDrawdownPct: Number.isFinite(maxDrawdownPct) ? maxDrawdownPct : null,
    tier,
  }
}

function clampBand(low: number, high: number, close: number, atrN: number): { low: number; high: number } {
  if (low >= high) {
    const m = (low + high) / 2
    const e = Math.max(atrN * 0.2, close * 1e-6)
    return { low: m - e, high: m + e }
  }
  return { low, high }
}

function separateZones(
  buy: { low: number; high: number },
  sell: { low: number; high: number },
  atrN: number
): { buy: { low: number; high: number }; sell: { low: number; high: number } } {
  const gap = Math.max(atrN * 0.35, Math.max(buy.high, sell.low) * 1e-8)
  if (buy.high <= sell.low - gap) return { buy, sell }
  const mid = (buy.high + sell.low) / 2
  const half = gap / 2
  return {
    buy: { low: buy.low, high: Math.min(buy.high, mid - half) },
    sell: { low: Math.max(sell.low, mid + half), high: sell.high },
  }
}

function resolveMonthlyAtr(highs: number[], lows: number[], closes: number[], n: number): number {
  const p = Math.min(14, Math.max(2, n - 1))
  const a = lastNonNull(atr(highs, lows, closes, p))
  if (a != null && a > 0) return a
  const span = Math.max(0, Math.max(...highs) - Math.min(...lows))
  const c = closes[n - 1] ?? 1
  return Math.max(span * 0.06, c * 0.008)
}

function applyBuyZoneSpotPull(
  buyLow: number,
  buyHigh: number,
  sellLow: number,
  sellHigh: number,
  close: number,
  atrN: number
): { buyLow: number; buyHigh: number; sellLow: number; sellHigh: number } {
  ;({ low: buyLow, high: buyHigh } = clampBand(buyLow, buyHigh, close, atrN))
  ;({ low: sellLow, high: sellHigh } = clampBand(sellLow, sellHigh, close, atrN))
  let sep = separateZones({ low: buyLow, high: buyHigh }, { low: sellLow, high: sellHigh }, atrN)
  buyLow = sep.buy.low
  buyHigh = sep.buy.high
  sellLow = sep.sell.low
  sellHigh = sep.sell.high

  const nudgeBuyBandBelowPrice = (): void => {
    const targetBuyLow = close - Math.max(atrN * 0.4, close * 0.018)
    const shift = buyLow - targetBuyLow
    buyLow -= shift
    buyHigh -= shift
    const minW = Math.max(atrN * 0.18, close * 0.0012)
    if (buyHigh - buyLow < minW) {
      const mid = (buyLow + buyHigh) / 2
      buyLow = mid - minW / 2
      buyHigh = mid + minW / 2
    }
    sep = separateZones({ low: buyLow, high: buyHigh }, { low: sellLow, high: sellHigh }, atrN)
    buyLow = sep.buy.low
    buyHigh = sep.buy.high
    sellLow = sep.sell.low
    sellHigh = sep.sell.high
  }

  if (close < buyLow) {
    nudgeBuyBandBelowPrice()
  }

  // separateZones / rounding: keep reference price at or above band low
  if (close < buyLow) {
    nudgeBuyBandBelowPrice()
  }

  return { buyLow, buyHigh, sellLow, sellHigh }
}

export function formatLongTermZoneTitle(z: LongTermStrategyZone, locale: Locale): string {
  return (locale === 'en' ? z.detailEn : z.detailFr).join('\n')
}

/** Limited-history mode: short monthly series, envelope + short ATR (no long MAs). */
function buildMonthlyBandPackLimited(
  highs: number[],
  lows: number[],
  closes: number[],
  spotClose: number
): Omit<PureLongTermStrategyResult, 'performance' | 'historyMonths' | 'mode' | 'risk'> | null {
  const n = closes.length
  if (n < INVESTOR_LT_MIN_MONTHLY_CLOSES) return null

  const i = n - 1
  const barClose = closes[i]!
  if (!(barClose > 0) || !(spotClose > 0)) return null

  const atrN = resolveMonthlyAtr(highs, lows, closes, n)

  const swingLow = Math.min(...lows.slice(0, n))
  const swingHigh = Math.max(...highs.slice(0, n))
  const span = Math.max(swingHigh - swingLow, spotClose * 0.025)

  let buyAnchor = (swingLow * 2 + spotClose) / 3
  let sellAnchor = (swingHigh * 2 + spotClose) / 3
  if (buyAnchor >= sellAnchor) {
    const mid = (swingLow + swingHigh) / 2
    buyAnchor = mid - span * 0.12
    sellAnchor = mid + span * 0.12
  }

  const buyHalf = Math.max(atrN * 0.55, span * 0.11, spotClose * 0.012)
  let buyLow = buyAnchor - buyHalf * 0.8
  let buyHigh = buyAnchor + buyHalf * 0.55

  const sellHalf = Math.max(atrN * 0.5, span * 0.1, spotClose * 0.012)
  let sellLow = sellAnchor - sellHalf * 0.42
  let sellHigh = sellAnchor + sellHalf * 0.88

  const fin = applyBuyZoneSpotPull(buyLow, buyHigh, sellLow, sellHigh, spotClose, atrN)
  buyLow = fin.buyLow
  buyHigh = fin.buyHigh
  sellLow = fin.sellLow
  sellHigh = fin.sellHigh

  const buyDetailFr: string[] = [
    `Historique limite (${n} mois) : zone d'achat derivee du bas d'enveloppe et du cours (pas de MM longue).`,
    `Mensuel synthetique : min ${swingLow.toFixed(4)} / max ${swingHigh.toFixed(4)} sur ${n} mois ; largeur relative ~${((buyHalf / barClose) * 100).toFixed(2)} %.`,
  ]
  const buyDetailEn: string[] = [
    `Limited history (${n} mo): buy band from range floor & price (no long MAs).`,
    `Synthetic monthly: min ${swingLow.toFixed(4)} / max ${swingHigh.toFixed(4)} over ${n} mo; width ~${((buyHalf / barClose) * 100).toFixed(2)}%.`,
  ]
  const sellDetailFr: string[] = [
    `Historique limite (${n} mois) : zone de vente vers le haut d'enveloppe (indicatif).`,
    `Objectif statistique faible fiabilite vs mode ${INVESTOR_MIN_MONTHLY_CLOSES}+ mois.`,
  ]
  const sellDetailEn: string[] = [
    `Limited history (${n} mo): sell band toward range top (indicative).`,
    `Low statistical confidence vs ${INVESTOR_MIN_MONTHLY_CLOSES}+ month mode.`,
  ]

  const buyCoh = Math.min(48, 34 + Math.round(Math.min(14, span / (atrN + 1e-9))))
  const sellCoh = Math.min(48, 34 + Math.round(Math.min(14, span / (atrN + 1e-9))))

  return {
    interval: INVESTOR_PURE_LT_INTERVAL,
    lastClose: spotClose,
    atr: atrN,
    buyZone: {
      low: buyLow,
      high: buyHigh,
      coherencePct: buyCoh,
      detailFr: buyDetailFr,
      detailEn: buyDetailEn,
    },
    sellZone: {
      low: sellLow,
      high: sellHigh,
      coherencePct: sellCoh,
      detailFr: sellDetailFr,
      detailEn: sellDetailEn,
    },
  }
}

function buildMonthlyBandPackFull(
  highs: number[],
  lows: number[],
  closes: number[],
  spotClose: number
): Omit<PureLongTermStrategyResult, 'performance' | 'historyMonths' | 'mode' | 'risk'> | null {
  const nFull = N_FULL_MONTHLY
  const n = closes.length
  if (n < INVESTOR_MIN_MONTHLY_CLOSES) return null

  const i = n - 1
  const barClose = closes[i]!
  if (!(barClose > 0) || !(spotClose > 0)) return null

  const atrN = lastNonNull(atr(highs, lows, closes, 14))
  if (atrN == null || !(atrN > 0)) return null

  const slowPeriod = monthlySlowEmaPeriod(n)
  const swing = Math.min(SWING_MONTHLY, Math.max(3, n - 2))

  const swingLow = minRecent(lows, n, swing)
  const swingHigh = maxRecent(highs, n, swing)
  const e20 = lastNonNull(ema(closes, 20))
  const eSlow = lastNonNull(ema(closes, slowPeriod))
  if (e20 == null || eSlow == null) return null

  const e100 = n >= nFull ? lastNonNull(ema(closes, 100)) : null

  const buyPartsBase = e100 != null ? [swingLow, eSlow, e100] : [swingLow, eSlow]
  let buyAnchor = buyPartsBase.reduce((a, b) => a + b, 0) / buyPartsBase.length
  if (spotClose < buyAnchor) {
    const over = buyAnchor - spotClose
    const scale = Math.min(1, over / Math.max(buyAnchor * 0.28, atrN * 1.2))
    buyAnchor = buyAnchor * (1 - 0.62 * scale) + spotClose * (0.62 * scale)
  }
  const buyHalf = Math.max(atrN * 0.42, spotClose * 0.0025)
  let buyLow = buyAnchor - buyHalf * 0.85
  let buyHigh = buyAnchor + buyHalf * 0.55

  const sellAnchor = (swingHigh + e20) / 2
  const sellHalf = Math.max(atrN * 0.38, spotClose * 0.0025)
  let sellLow = sellAnchor - sellHalf * 0.45
  let sellHigh = sellAnchor + sellHalf * 0.9

  const fin = applyBuyZoneSpotPull(buyLow, buyHigh, sellLow, sellHigh, spotClose, atrN)
  buyLow = fin.buyLow
  buyHigh = fin.buyHigh
  sellLow = fin.sellLow
  sellHigh = fin.sellHigh

  const r = rsi(closes, 14)
  const rsiNow = r[i]
  const { hist } = macd(closes)
  const mh = hist[i]
  const mhp = i > 0 ? hist[i - 1] : null

  const buyDetailFr: string[] = []
  const buyDetailEn: string[] = []
  let buyCoh = 0
  const mmSlowFr = `MM${slowPeriod}`
  const emaSlowEn = `EMA${slowPeriod}`
  if (e100 != null && eSlow > e100) {
    buyCoh += 22
    buyDetailFr.push(`${mmSlowFr} > MM100 (tendance mensuelle de fond)`)
    buyDetailEn.push(`${emaSlowEn} > EMA100 (monthly LT trend)`)
  }
  if (barClose > eSlow) {
    buyCoh += 22
    buyDetailFr.push(`Cloture mensuelle au-dessus de la ${mmSlowFr}`)
    buyDetailEn.push(`Monthly close above ${emaSlowEn}`)
  } else {
    buyDetailFr.push(
      `Cloture sous ${mmSlowFr} mensuelle : zone vue comme repositionnement sur plusieurs cycles`
    )
    buyDetailEn.push(`Below monthly ${emaSlowEn}: multi-cycle repositioning read`)
  }
  if (rsiNow != null && rsiNow >= 32 && rsiNow <= 68) {
    buyCoh += 20
    buyDetailFr.push(`RSI ${Math.round(rsiNow)} (mensuel) dans une plage calme`)
    buyDetailEn.push(`RSI ${Math.round(rsiNow)} (monthly) in a calm band`)
  } else if (rsiNow != null) {
    buyDetailFr.push(`RSI ${Math.round(rsiNow)} hors plage neutre`)
    buyDetailEn.push(`RSI ${Math.round(rsiNow)} outside neutral band`)
  }
  if (mh != null && mhp != null && (mh >= 0 || mh > mhp)) {
    buyCoh += 18
    buyDetailFr.push('MACD mensuel compatible avec accumulation patiente')
    buyDetailEn.push('Monthly MACD supportive of patient accumulation')
  }
  if (Math.abs(swingLow - eSlow) <= atrN * 1.8) {
    buyCoh += 18
    buyDetailFr.push(`Creux ~${swing} mois proche du socle ${mmSlowFr} mensuelle`)
    buyDetailEn.push(`~${swing}-month low near monthly ${emaSlowEn} floor`)
  }
  buyDetailFr.unshift(
    e100 != null
      ? `Mensuel : moyenne creux ${swing} mois / ${mmSlowFr} / MM100 ; largeur ~${((buyHalf / barClose) * 100).toFixed(2)} %`
      : `Mensuel : moyenne creux ${swing} mois / ${mmSlowFr} ; largeur ~${((buyHalf / barClose) * 100).toFixed(2)} %`
  )
  buyDetailEn.unshift(
    e100 != null
      ? `Monthly: ${swing}-month low blend & ${emaSlowEn} & EMA100; width ~${((buyHalf / barClose) * 100).toFixed(2)}%`
      : `Monthly: ${swing}-month low blend & ${emaSlowEn}; width ~${((buyHalf / barClose) * 100).toFixed(2)}%`
  )
  buyCoh = Math.min(100, Math.round(buyCoh))

  const sellDetailFr: string[] = []
  const sellDetailEn: string[] = []
  let sellCoh = 0
  if (barClose < swingHigh - atrN * 0.15) {
    sellCoh += 20
    sellDetailFr.push(`Marge sous sommet ~${swing} mois vers resistance mensuelle`)
    sellDetailEn.push(`Room under ~${swing}-month high toward monthly resistance`)
  }
  if (e20 >= barClose - atrN * 0.05 || swingHigh >= barClose - atrN * 0.05) {
    sellCoh += 22
    sellDetailFr.push('MM20 mensuelle / sommet comme plafond structurel')
    sellDetailEn.push('Monthly EMA20 / swing as structural cap')
  }
  if (rsiNow != null && rsiNow >= 40) {
    sellCoh += 18
    sellDetailFr.push(
      `RSI ${Math.round(rsiNow)} : contexte de reduction / prise de benefice sur horizon cycle`
    )
    sellDetailEn.push(`RSI ${Math.round(rsiNow)}: trimming / de-risk across cycle horizon`)
  }
  if (mh != null && mhp != null && (mh <= 0 || mh < mhp)) {
    sellCoh += 18
    sellDetailFr.push('MACD mensuel en repli : resistances / distribution')
    sellDetailEn.push('Monthly MACD fading: resistance / distribution read')
  }
  sellCoh += Math.min(22, Math.round((Math.abs(swingHigh - e20) / atrN) * 5))
  sellDetailFr.unshift(`Mensuel : moyenne sommet ${swing} mois / MM20 mensuelle`)
  sellDetailEn.unshift(`Monthly: ${swing}-month high mean & monthly EMA20`)
  sellCoh = Math.min(100, Math.max(0, Math.round(sellCoh)))

  return {
    interval: INVESTOR_PURE_LT_INTERVAL,
    lastClose: spotClose,
    atr: atrN,
    buyZone: { low: buyLow, high: buyHigh, coherencePct: buyCoh, detailFr: buyDetailFr, detailEn: buyDetailEn },
    sellZone: {
      low: sellLow,
      high: sellHigh,
      coherencePct: sellCoh,
      detailFr: sellDetailFr,
      detailEn: sellDetailEn,
    },
  }
}

function gaugeFromZones(
  buyZone: LongTermStrategyZone,
  sellZone: LongTermStrategyZone,
  lastClose: number,
  atrN: number
): {
  runPct: number | null
  rr: number | null
  cohAvg: number
  scoreParts: { runPts: number; rrPts: number }
} {
  const buyMid = (buyZone.low + buyZone.high) / 2
  const sellMid = (sellZone.low + sellZone.high) / 2
  const runPct = sellMid > buyMid && buyMid > 0 ? ((sellMid - buyMid) / buyMid) * 100 : null
  const stopRef = buyZone.low - atrN
  let rr: number | null = null
  if (stopRef > 0 && sellMid > buyMid) {
    const risk = buyMid - stopRef
    const reward = sellMid - buyMid
    if (risk > lastClose * 1e-8) rr = reward / risk
  }
  const cohAvg = (buyZone.coherencePct + sellZone.coherencePct) / 2
  const runPts = runPct != null ? Math.min(38, Math.max(0, runPct * 3.2)) : 0
  const rrPts = rr != null && Number.isFinite(rr) && rr > 0 ? Math.min(32, rr * 9) : 0
  return { runPct, rr, cohAvg, scoreParts: { runPts, rrPts } }
}

function scoreFromParts(cohAvg: number, runPts: number, rrPts: number): number {
  return Math.round(Math.min(100, Math.max(0, cohAvg * 0.42 + runPts * 0.35 + rrPts * 0.35)))
}

/**
 * Bandes et jauge qualitatives sur le mensuel (agregation journaliere).
 * Mode complet si >= INVESTOR_MIN_MONTHLY_CLOSES mois, sinon mode limite (>= 1 mois).
 */
export function computePureLongTermStrategy(
  highs: number[],
  lows: number[],
  closes: number[],
  locale: Locale,
  /** Last price on the Plan strip (plan interval close) so LT bands match what you see. */
  planReferencePrice?: number | null
): PureLongTermStrategyResult | null {
  void locale
  const n = closes.length
  if (n < INVESTOR_LT_MIN_MONTHLY_CLOSES) return null

  const monthClose = closes[n - 1]!
  const spotClose =
    planReferencePrice != null && planReferencePrice > 0 && Number.isFinite(planReferencePrice)
      ? planReferencePrice
      : monthClose

  const mode: 'full' | 'limited' = n >= INVESTOR_MIN_MONTHLY_CLOSES ? 'full' : 'limited'
  const base =
    mode === 'full'
      ? buildMonthlyBandPackFull(highs, lows, closes, spotClose)
      : buildMonthlyBandPackLimited(highs, lows, closes, spotClose)
  if (!base) return null

  const g = gaugeFromZones(base.buyZone, base.sellZone, base.lastClose, base.atr)
  const scoreCap = mode === 'limited' ? 72 : 100
  let score0to100 = scoreFromParts(g.cohAvg, g.scoreParts.runPts, g.scoreParts.rrPts)
  if (mode === 'limited') score0to100 = Math.min(scoreCap, Math.max(22, score0to100 - 8))

  const performance: LongTermPerformanceGauge = {
    score0to100,
    structuralRunPct: g.runPct,
    indicativeRr: g.rr,
    executionRunPct: null,
  }

  const risk = computeLtRiskFromMonthlyCloses(closes)

  return {
    ...base,
    historyMonths: n,
    mode,
    performance,
    risk,
  }
}
