import { useEffect, useState } from 'react'
import { fetchCandleSnapshot } from '../lib/hyperliquid'
import { candlesToOHLC } from '../lib/scanMarket'
import { intervalToMs, type HlInterval } from '../lib/interval'
import { atr, ema, lastNonNull, macd, rsi } from '../lib/indicators'
import {
  detectRegime,
  evaluateStrategies,
  type Regime,
  type StrategyVote,
} from '../lib/strategies'
import type { Locale } from '../i18n/locale'

/** Pyramide confluence · ordre fetch [1W] … [1M] (large → fin). */
export const PLAN_COMPARE_TF: readonly HlInterval[] = [
  '1w',
  '1d',
  '4h',
  '1h',
  '15m',
  '5m',
  '1m',
]

/**
 * Fenêtres bougies MTF preset `plan` — volontairement compactes pour réduire la latence au chargement.
 * Régime / stratégies : ≥60 bougies ; ret 7j 15m peut rester « — » si l’historique est trop court.
 */
const FETCH_BARS_1M = 600 /* ~10 h ; régime ≥60 ~1 h */
const FETCH_BARS_5M = 400 /* ~33 h ; regime ≥60 ~5 h */
const FETCH_BARS_15M = 300 /* ~3 j ; ret 24h OK (~96 barres) */
const FETCH_BARS_1H = 200 /* ~8 j ; ret 7j OK (168 barres) */
const FETCH_BARS_4H = 100 /* ~17 j */
const FETCH_BARS_1D = 120
const FETCH_BARS_1W = 96 /* ~2 ans */

function fetchBarsForInterval(interval: HlInterval): number {
  switch (interval) {
    case '1m':
      return FETCH_BARS_1M
    case '5m':
      return FETCH_BARS_5M
    case '15m':
      return FETCH_BARS_15M
    case '1h':
      return FETCH_BARS_1H
    case '4h':
      return FETCH_BARS_4H
    case '1d':
      return FETCH_BARS_1D
    case '1w':
      return FETCH_BARS_1W
    default:
      return FETCH_BARS_1H
  }
}

export type PlanTfFetchPreset = 'plan' | 'scan'

/** Fenêtres courtes pour le scan Opportunités (réponses `/info` plus légères ; régime ≥60 bougies conservé). */
function fetchBarsForIntervalScan(interval: HlInterval): number {
  switch (interval) {
    case '1m':
      return 240
    case '5m':
      return 220
    case '15m':
      return 160
    case '1h':
      return 96
    case '4h':
      return 96
    case '1d':
      return 90
    case '1w':
      return 52
    default:
      return 96
  }
}

function barsForPreset(interval: HlInterval, preset: PlanTfFetchPreset): number {
  return preset === 'scan' ? fetchBarsForIntervalScan(interval) : fetchBarsForInterval(interval)
}

function regimeLabelFr(label: Regime['label']): string {
  switch (label) {
    case 'tendance':
      return 'Tendance'
    case 'range':
      return 'Range'
    case 'volatile':
      return 'Volatile'
    default:
      return label
  }
}

function regimeRowLabel(locale: Locale, regime: Regime | null, closesLen: number): string {
  if (regime) {
    if (locale === 'en') {
      if (regime.label === 'tendance') return 'Trending'
      if (regime.label === 'volatile') return 'Volatile'
      return 'Range'
    }
    return regimeLabelFr(regime.label)
  }
  return closesLen >= 60 ? '—' : locale === 'en' ? 'Partial data' : 'Δ données'
}

function pctReturn(closes: number[], barsBack: number): number | null {
  const n = closes.length
  if (n < barsBack + 1 || barsBack < 1) return null
  const from = closes[n - 1 - barsBack]
  const to = closes[n - 1]
  if (from == null || from === 0) return null
  return ((to - from) / from) * 100
}

function barsForApproxHours(interval: HlInterval, hours: number): number {
  return Math.max(2, Math.ceil((hours * 3_600_000) / intervalToMs(interval)))
}

function describeEmaStructure(
  closes: number[],
  e20: number | null,
  e50: number | null,
  locale: Locale
): string {
  const c = closes[closes.length - 1]
  if (e20 == null || e50 == null || c == null) return '—'
  const trendUp = e20 > e50
  const priceAbove20 = c >= e20
  if (locale === 'en') {
    if (trendUp && priceAbove20) return 'Uptrend · price ≥ EMA20 > EMA50'
    if (!trendUp && !priceAbove20) return 'Downtrend · price ≤ EMA20 < EMA50'
    if (trendUp && !priceAbove20) return 'Uptrend structure but price below EMA20 (pullback)'
    return 'Downtrend structure but price above EMA20 (relief)'
  }
  if (trendUp && priceAbove20) return 'Hausse · prix ≥ EMA20 > EMA50'
  if (!trendUp && !priceAbove20) return 'Baisse · prix ≤ EMA20 < EMA50'
  if (trendUp && !priceAbove20) return 'Structure ↑ mais prix sous EMA20 (pullback)'
  return 'Structure ↓ mais prix au-dessus EMA20 (relief)'
}

function describeMacdHist(hist: (number | null)[], locale: Locale): string {
  const n = hist.length
  if (n < 2) return '—'
  const hi = hist[n - 1]
  const hip = hist[n - 2]
  if (hi == null || hip == null) return '—'
  if (locale === 'en') {
    if (hi > 0 && hi >= hip) return hi > hip ? 'MACD hist ↑ above 0' : 'MACD hist > 0 (flat)'
    if (hi < 0 && hi <= hip) return hi < hip ? 'MACD hist ↓ below 0' : 'MACD hist < 0 (flat)'
    if (hi >= 0 && hip < 0) return 'MACD hist cross above 0'
    return 'MACD hist cross below 0'
  }
  if (hi > 0 && hi >= hip) return hi > hip ? 'MACD hist ↑ au-dessus 0' : 'MACD hist > 0 (stable)'
  if (hi < 0 && hi <= hip) return hi < hip ? 'MACD hist ↓ sous 0' : 'MACD hist < 0 (stable)'
  if (hi >= 0 && hip < 0) return 'MACD hist passage au-dessus 0'
  return 'MACD hist passage sous 0'
}

export function describeMacdHistogramHint(closes: number[]): string {
  const { hist } = macd(closes)
  return describeMacdHist(hist, 'fr')
}

export interface PlanTfRow {
  interval: HlInterval
  /** Bougies utilisées après fetch */
  bars: number
  error?: string
  ret24hPct: number | null
  ret7dPct: number | null
  regime: Regime | null
  regimeLabel: string
  regimeExplanation: string | null
  bestVote: StrategyVote | null
  confirmedStrong: boolean
  rsi: number | null
  atrOverPricePct: number | null
  emaStructure: string
  macdHint: string
  /** Pour jauges prix / EMA sur la carte UT */
  lastClose: number | null
  ema20: number | null
  ema50: number | null
  /** Répartition des directions parmi les 3 stratégies */
  longShortNeutral: string
  /** Moyenne pondérée des votes directionnels (long+, short−), pour lecture rapide */
  directionalSkew: number | null
  /** Les 3 stratégies : pour confluence avec la stratégie du plan */
  votes: StrategyVote[]
  /** Plus haut / plus bas récents (≈20 bougies) — mur daily pour Room to Run */
  recentHigh20: number | null
  recentLow20: number | null
}

function buildTfRow(
  interval: HlInterval,
  closes: number[],
  highs: number[],
  lows: number[],
  locale: Locale
): PlanTfRow {
  const base: PlanTfRow = {
    interval,
    bars: closes.length,
    ret24hPct: null,
    ret7dPct: null,
    regime: null,
    regimeLabel: '—',
    regimeExplanation: null,
    bestVote: null,
    confirmedStrong: false,
    rsi: null,
    atrOverPricePct: null,
    emaStructure: '—',
    macdHint: '—',
    lastClose: null,
    ema20: null,
    ema50: null,
    longShortNeutral: '—',
    directionalSkew: null,
    votes: [],
    recentHigh20: null,
    recentLow20: null,
  }

  if (closes.length < 30) {
    return {
      ...base,
      error: locale === 'en' ? 'History too short' : 'Historique trop court',
      votes: [],
    }
  }

  const h24 = barsForApproxHours(interval, 24)
  const d7 = barsForApproxHours(interval, 24 * 7)
  const ret24hPct = pctReturn(closes, h24)
  const ret7dPct = pctReturn(closes, d7)

  const regime = closes.length >= 60 ? detectRegime(closes, highs, lows) : null
  const ev =
    regime && closes.length >= 60
      ? evaluateStrategies(closes, highs, lows, regime)
      : null

  const bestVote = ev ? ev.best : null
  const confirmedStrong = ev?.best != null

  const r = rsi(closes, 14)
  const rsiN = lastNonNull(r)

  const a = atr(highs, lows, closes, 14)
  const atrN = lastNonNull(a)
  const c = closes[closes.length - 1]
  const atrOverPricePct =
    atrN != null && c != null && c !== 0 ? (atrN / c) * 100 : null

  const e20 = lastNonNull(ema(closes, 20))
  const e50 = lastNonNull(ema(closes, 50))
  const emaStructure = describeEmaStructure(closes, e20, e50, locale)

  const { hist } = macd(closes)
  const macdHint = describeMacdHist(hist, locale)

  let recentHigh20: number | null = null
  let recentLow20: number | null = null
  if (highs.length >= 20 && lows.length >= 20) {
    const sh = highs.slice(-20)
    const sl = lows.slice(-20)
    recentHigh20 = Math.max(...sh)
    recentLow20 = Math.min(...sl)
  }

  let longC = 0
  let shortC = 0
  let flatC = 0
  let skewNum = 0
  let skewDen = 0
  if (ev) {
    for (const v of ev.votes) {
      if (v.direction === 'long') longC++
      else if (v.direction === 'short') shortC++
      else flatC++
      if (v.direction !== 'flat') {
        skewNum += v.direction === 'long' ? v.weighted : -v.weighted
        skewDen += v.weighted
      }
    }
  }
  const neutralWord = locale === 'en' ? 'neutral' : 'neutre'
  const longShortNeutral = ev
    ? `${longC} long · ${shortC} short · ${flatC} ${neutralWord}`
    : '—'
  const directionalSkew = skewDen > 0 ? skewNum / skewDen : null

  return {
    ...base,
    ret24hPct,
    ret7dPct,
    regime,
    regimeLabel: regimeRowLabel(locale, regime, closes.length),
    regimeExplanation: regime?.explanation ?? null,
    bestVote,
    confirmedStrong,
    rsi: rsiN,
    atrOverPricePct,
    emaStructure,
    macdHint,
    lastClose: c ?? null,
    ema20: e20,
    ema50: e50,
    longShortNeutral,
    directionalSkew,
    votes: ev?.votes ?? [],
    recentHigh20,
    recentLow20,
  }
}

function emptyTfRow(interval: HlInterval, errorMsg?: string): PlanTfRow {
  return {
    interval,
    bars: 0,
    error: errorMsg,
    ret24hPct: null,
    ret7dPct: null,
    regime: null,
    regimeLabel: '—',
    regimeExplanation: null,
    bestVote: null,
    confirmedStrong: false,
    rsi: null,
    atrOverPricePct: null,
    emaStructure: '—',
    macdHint: '—',
    lastClose: null,
    ema20: null,
    ema50: null,
    longShortNeutral: '—',
    directionalSkew: null,
    votes: [],
    recentHigh20: null,
    recentLow20: null,
  }
}

/** Charge les horizons pyramidaux (1 semaine → 1 minute) pour une paire.
 * `preset: 'scan'` → moins de bougies (filtre Opportunités, priorité latence).
 */
export async function fetchPlanTfRowsForCoin(
  coin: string,
  opts?: { preset?: PlanTfFetchPreset; locale?: Locale }
): Promise<PlanTfRow[]> {
  const preset = opts?.preset ?? 'plan'
  const locale = opts?.locale ?? 'fr'
  const end = Date.now()
  return Promise.all(
    PLAN_COMPARE_TF.map(async (interval) => {
      try {
        const ms = intervalToMs(interval)
        const nBars = barsForPreset(interval, preset)
        const start = end - ms * nBars
        const raw = await fetchCandleSnapshot({
          coin,
          interval,
          startTime: start,
          endTime: end,
        })
        const sorted = [...raw].sort((a, b) => a.t - b.t)
        const { closes, highs, lows } = candlesToOHLC(sorted)
        return buildTfRow(interval, closes, highs, lows, locale)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return emptyTfRow(interval, msg.slice(0, 120))
      }
    })
  )
}

export function usePlanMultiTf(coin: string, locale: Locale) {
  const [rows, setRows] = useState<PlanTfRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!coin) return
    let cancelled = false
    setLoading(true)
    setRows([])

    void (async () => {
      const batch = await fetchPlanTfRowsForCoin(coin, { locale })

      if (!cancelled) {
        setRows(batch)
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [coin, locale])

  return { rows, loading }
}
