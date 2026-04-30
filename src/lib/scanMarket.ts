import type { HlCandle } from './hyperliquid'
import type { Locale } from '../i18n/locale'
import type { HlInterval } from './interval'
import { detectRegime, evaluateStrategies } from './strategies'
import type { Direction, StrategyId } from './strategies'
import { ema, highest, lastNonNull, lowest, macd, rsi } from './indicators'

/** Seuil affichage liste « Opportunités » : % de critères indicateurs validés (4 au total). */
/** Seuil de confluence brute avant filtre « tradable » — volontairement plus bas pour éviter une liste vide. */
export const MIN_SCAN_CONFLUENCE_PCT = 52

export interface IndicatorChecks {
  ema: boolean
  rsi: boolean
  macd: boolean
  volume: boolean
}

/** 0 = baissier (rouge), 50 = neutre, 100 = haussier (vert). */
export interface IndicatorGaugesPct {
  ema: number
  rsi: number
  macd: number
  volume: number
}

export interface ScanTrendSummary {
  label: 'long' | 'short' | 'neutral'
  /** 1 = faible … 3 = fort */
  strength: 1 | 2 | 3
}

function clampPct(x: number): number {
  return Math.min(100, Math.max(0, x))
}

/**
 * Lecture « absolue » par indicateur (hors alignement stratégie),
 * pour jauges rouge → vert.
 */
export function computeIndicatorGauges(
  closes: number[],
  _highs: number[],
  _lows: number[],
  vols: number[]
): IndicatorGaugesPct | null {
  const n = closes.length
  const i = n - 1
  if (n < 22 || i < 1) return null

  const c = closes[i]

  let emaPct = 50
  const e20 = lastNonNull(ema(closes, 20))
  const e50 = lastNonNull(ema(closes, 50))
  if (e20 != null && e50 != null && Math.abs(e50) > 1e-12) {
    const sep = (e20 - e50) / Math.abs(e50)
    const px = (c - e20) / Math.abs(e20)
    emaPct = clampPct(50 + sep * 380 + px * 320)
  }

  let rsiPct = 50
  const r = rsi(closes, 14)
  const rsiNow = r[i]
  if (rsiNow != null) {
    /** Aligné sur l’échelle RSI 0–100 : le score affiché = lecture RSI directe. */
    rsiPct = clampPct(rsiNow)
  }

  let macdPct = 50
  const { hist } = macd(closes)
  const hi = hist[i]
  const hip = i > 0 ? hist[i - 1] : null
  if (hi != null) {
    const slope = hip != null ? hi - hip : 0
    macdPct = clampPct(50 + hi * 140 + slope * 420)
  }

  let volPct = 50
  if (vols.length >= 22 && closes[i - 1] !== 0) {
    const avg = vols.slice(-21, -1).reduce((a, b) => a + b, 0) / 20
    const vr = avg > 0 ? vols[i] / avg : 1
    const ret = (c - closes[i - 1]) / closes[i - 1]
    volPct = clampPct(
      50 +
        Math.sign(ret) * Math.min(38, Math.abs(ret) * 9000) +
        Math.min(18, (vr - 1) * 22)
    )
  }

  return { ema: emaPct, rsi: rsiPct, macd: macdPct, volume: volPct }
}

export function summarizeScanTrend(g: IndicatorGaugesPct): ScanTrendSummary {
  const avg = (g.ema + g.rsi + g.macd + g.volume) / 4
  if (avg >= 56) {
    const d = avg - 50
    const strength = (d >= 22 ? 3 : d >= 12 ? 2 : 1) as 1 | 2 | 3
    return { label: 'long', strength }
  }
  if (avg <= 44) {
    const d = 50 - avg
    const strength = (d >= 22 ? 3 : d >= 12 ? 2 : 1) as 1 | 2 | 3
    return { label: 'short', strength }
  }
  const spread =
    Math.max(g.ema, g.rsi, g.macd, g.volume) -
    Math.min(g.ema, g.rsi, g.macd, g.volume)
  const strength = (spread >= 38 ? 2 : 1) as 1 | 2 | 3
  return { label: 'neutral', strength }
}

/** Perf coin vs fenêtre équivalente BTC : même intervalle, même horizon en bougies. */
export type RelativeVsBtc = 'outperform' | 'inline' | 'underperform'

export interface ScanSignal {
  coin: string
  direction: Exclude<Direction, 'flat'>
  strategyId: StrategyId
  strategyName: string
  weighted: number
  regimeLabel: string | null
  lastClose: number
  /** Signal au-dessus du seuil habituel — sinon indication faible mais directionnelle */
  confirmed: boolean
  regimeExplanation: string | null
  strategyReasons: string[]
  checks: IndicatorChecks
  /** Nombre de critères parmi les 4 qui sont OK pour ce sens */
  validatedCount: number
  /** 0–100 */
  confluencePct: number
  /** Espace prix vers le niveau opposé au trade (% du prix), pour lecture « room to run » */
  roomToRunPct: number | null
  /** Position du prix dans le range récent [ll, hh], 0–1 */
  rangePosition: number | null
  relativeVsBtc: RelativeVsBtc | null
  indicatorGauges: IndicatorGaugesPct | null
  scanTrend: ScanTrendSummary | null
}

function strategyDisplayName(locale: Locale, id: StrategyId): string {
  switch (id) {
    case 'trend_ema_macd':
      return locale === 'en' ? 'Trend (EMA + MACD)' : 'Tendance (EMA + MACD)'
    case 'mean_reversion_rsi':
      return locale === 'en' ? 'Mean reversion (RSI)' : 'Contre-tendance (RSI)'
    case 'breakout_range':
      return locale === 'en' ? 'Breakout (20-range + ATR)' : 'Breakout (range 20 + ATR)'
    default:
      return id
  }
}

function regimeDisplayForUi(locale: Locale, raw: string | null): string | null {
  if (raw == null || raw === '' || raw === '—') return null
  if (locale === 'en') {
    if (raw === 'tendance') return 'Trending'
    if (raw === 'range') return 'Range'
    if (raw === 'volatile') return 'Volatile'
    return raw
  }
  if (raw === 'tendance') return 'Tendance'
  if (raw === 'range') return 'Range'
  if (raw === 'volatile') return 'Volatile'
  return raw
}

/** Libellé d’intervalle pour l’UI (scan / plan). */
export function formatScanIntervalLabel(locale: Locale, iv: HlInterval): string {
  if (locale === 'en') {
    if (iv === '15m') return '15 minutes'
    if (iv === '1h') return '1 hour'
    if (iv === '4h') return '4 hours'
    if (iv === '1d') return 'daily'
    return iv
  }
  if (iv === '15m') return '15 minutes'
  if (iv === '1h') return '1 heure'
  if (iv === '4h') return '4 heures'
  if (iv === '1d') return 'journalier'
  return iv
}

/** @deprecated Utiliser formatScanIntervalLabel avec locale explicite. */
export function formatScanIntervalLabelFr(iv: HlInterval): string {
  return formatScanIntervalLabel('fr', iv)
}

/**
 * Une ligne lisible pour le tableau (survol pour le détail).
 */
export function formatOpportunityInstruction(
  s: ScanSignal,
  scanIv: HlInterval,
  locale: Locale = 'fr'
): string {
  const tf = formatScanIntervalLabel(locale, scanIv)
  const dir = s.direction === 'long' ? 'Long' : 'Short'
  const regimeRaw = regimeDisplayForUi(locale, s.regimeLabel)
  const regime = regimeRaw != null && regimeRaw !== '—' ? ` · ${regimeRaw}` : ''
  const qual = s.confirmed ? '' : locale === 'en' ? ' · light' : ' · léger'
  return `${dir} · ${tf}${regime}${qual}`
}

/** Infobulle courte (évite les paragraphes dans le tableau). */
export function formatOpportunityTooltip(s: ScanSignal, locale: Locale = 'fr'): string {
  const crit = locale === 'en' ? 'criteria' : 'critères'
  const marge = locale === 'en' ? 'room ~' : 'marge ~'
  const bits = [
    strategyDisplayName(locale, s.strategyId),
    `${Math.round(s.confluencePct)} % ${crit}`,
    s.roomToRunPct != null ? `${marge}${s.roomToRunPct.toFixed(1)} %` : null,
  ].filter(Boolean)
  return bits.join(' · ')
}

/**
 * Pertinence setup vs biais agrégé : 2 = même sens, 1 = neutre ou inconnu, 0 = contradiction.
 */
export function scanSetupBiasAlignmentRank(s: ScanSignal): number {
  const t = s.scanTrend
  if (!t) return 1
  if (
    (s.direction === 'long' && t.label === 'long') ||
    (s.direction === 'short' && t.label === 'short')
  )
    return 2
  if (
    (s.direction === 'long' && t.label === 'short') ||
    (s.direction === 'short' && t.label === 'long')
  )
    return 0
  return 1
}

/**
 * Score de conviction 0–100 : agrège confluence indicateurs, force du biais agrégé,
 * accord marché/setup, confirmation stratégie, pondération du vote et perf. vs BTC.
 * Indicateur qualitatif, pas une probabilité statistique que le trade « réussisse ».
 */
export function tradeConvictionScore(s: ScanSignal): number {
  const strength = s.scanTrend?.strength ?? 1
  const align = scanSetupBiasAlignmentRank(s)
  const w = Math.min(1, Math.max(0, s.weighted))

  let score =
    s.confluencePct * 0.26 +
    strength * 10 +
    (align === 2 ? 20 : align === 1 ? 9 : 0) +
    (s.confirmed ? 11 : 0) +
    w * 12

  if (s.relativeVsBtc === 'outperform') score += 3
  else if (s.relativeVsBtc === 'underperform') score -= 3

  if (align === 0) score *= 0.74

  return Math.round(Math.min(100, Math.max(0, score)))
}

function formatIndicatorMarks(checks: IndicatorChecks): string {
  const ok = (x: boolean) => (x ? '✓' : '✗')
  return `EMA ${ok(checks.ema)} · RSI ${ok(checks.rsi)} · MACD ${ok(checks.macd)} · Vol ${ok(checks.volume)}`
}

/**
 * Infobulle tableau Opportunités : sens aligné sur la ligne, indicateurs succincts, score expliqué (≠ probabilité).
 */
export function formatOpportunityRowTooltip(
  s: ScanSignal,
  scanIv: HlInterval,
  locale: Locale = 'fr'
): string {
  const tf = formatScanIntervalLabel(locale, scanIv)
  const dirWord = s.direction === 'long' ? 'LONG' : 'SHORT'
  const regimeDisp = regimeDisplayForUi(locale, s.regimeLabel)
  const regimeOk = regimeDisp != null && regimeDisp !== '—'
  const head = regimeOk ? `${dirWord} · ${tf} · ${regimeDisp}` : `${dirWord} · ${tf}`
  const indicators =
    locale === 'en'
      ? `Indicators (${dirWord}): ${formatIndicatorMarks(s.checks)} → ${s.validatedCount}/4`
      : `Indicateurs (${dirWord}) : ${formatIndicatorMarks(s.checks)} → ${s.validatedCount}/4`
  const score = tradeConvictionScore(s)
  const scoreExplain =
    locale === 'en'
      ? `Score ${score}/100: blends ~${Math.round(s.confluencePct)}% checks, trend strength, strategy/market alignment, weighted vote and light vs BTC.`
      : `Score ${score}/100 : combine ~${Math.round(s.confluencePct)} % critères, intensité tendance, accord stratégie/marché, vote pondéré et léger vs BTC.`
  const disclaimer =
    locale === 'en'
      ? `Qualitative only — not a probability of hitting TP or avoiding SL.`
      : `Qualitatif uniquement — pas une probabilité de TP ni contre le SL.`
  const strat = strategyDisplayName(locale, s.strategyId)
  const setup =
    locale === 'en'
      ? s.confirmed
        ? `Setup: ${strat}`
        : `Setup: ${strat} (directional, strategy threshold not cleared)`
      : s.confirmed
        ? `Setup : ${strat}`
        : `Setup : ${strat} (directionnel, seuil stratégie non franchi)`
  return [head, indicators, scoreExplain, disclaimer, setup].join('\n')
}

/**
 * Tri liste Opportunités : force du biais agrégé, accord marché/setup, puis qualité scanner.
 */
export function compareScanOpportunities(a: ScanSignal, b: ScanSignal): number {
  const sta = a.scanTrend?.strength ?? 1
  const stb = b.scanTrend?.strength ?? 1
  if (stb !== sta) return stb - sta
  const aa = scanSetupBiasAlignmentRank(a)
  const ab = scanSetupBiasAlignmentRank(b)
  if (ab !== aa) return ab - aa
  if (Number(b.confirmed) !== Number(a.confirmed)) return Number(b.confirmed) - Number(a.confirmed)
  if (b.validatedCount !== a.validatedCount) return b.validatedCount - a.validatedCount
  if (b.weighted !== a.weighted) return b.weighted - a.weighted
  const ca = tradeConvictionScore(a)
  const cb = tradeConvictionScore(b)
  if (cb !== ca) return cb - ca
  return b.confluencePct - a.confluencePct
}

export function candlesToOHLC(candles: HlCandle[]): {
  closes: number[]
  highs: number[]
  lows: number[]
  vols: number[]
} {
  const sorted = [...candles].sort((a, b) => a.t - b.t)
  return {
    closes: sorted.map((c) => c.c),
    highs: sorted.map((c) => c.h),
    lows: sorted.map((c) => c.l),
    vols: sorted.map((c) => c.v),
  }
}

function pctReturn(closes: number[], barsBack: number): number | null {
  const n = closes.length
  if (n < barsBack + 1 || barsBack < 1) return null
  const from = closes[n - 1 - barsBack]
  const to = closes[n - 1]
  if (from == null || from === 0) return null
  return (to - from) / from
}

function classifyVsBtc(coinRet: number, btcRet: number): RelativeVsBtc {
  const diff = coinRet - btcRet
  if (diff > 0.0008) return 'outperform'
  if (diff < -0.0008) return 'underperform'
  return 'inline'
}

/** Critères alignés sur la direction du trade (pas une vérité absolue du marché). */
export function computeIndicatorChecks(
  direction: Exclude<Direction, 'flat'>,
  closes: number[],
  _highs: number[],
  _lows: number[],
  vols: number[]
): IndicatorChecks {
  const n = closes.length
  const i = n - 1
  const c = closes[i]

  const e20 = lastNonNull(ema(closes, 20))
  const e50 = lastNonNull(ema(closes, 50))
  let emaOk = false
  if (e20 != null && e50 != null) {
    if (direction === 'long') emaOk = c > e20 && e20 >= e50
    else emaOk = c < e20 && e20 <= e50
  }

  const r = rsi(closes, 14)
  const rsiNow = r[i]
  const rsiPrev = i > 0 ? r[i - 1] : null
  let rsiOk = false
  if (rsiNow != null && rsiPrev != null) {
    if (direction === 'long')
      rsiOk = rsiNow >= 32 && rsiNow <= 72 && !(rsiNow > 68 && rsiNow < rsiPrev)
    else rsiOk = rsiNow <= 68 && rsiNow >= 28 && !(rsiNow < 32 && rsiNow > rsiPrev)
  }

  const { hist } = macd(closes)
  const hi = hist[i]
  const hip = i > 0 ? hist[i - 1] : null
  let macdOk = false
  if (hi != null && hip != null) {
    if (direction === 'long') macdOk = hi >= hip || hi > 0
    else macdOk = hi <= hip || hi < 0
  }

  let volumeOk = false
  if (vols.length >= 22 && vols[i] != null) {
    const avg =
      vols.slice(-21, -1).reduce((a, b) => a + b, 0) / 20
    if (avg > 0) volumeOk = vols[i] >= avg * 0.88
  }

  return { ema: emaOk, rsi: rsiOk, macd: macdOk, volume: volumeOk }
}

export function computeRoomMetrics(
  direction: Exclude<Direction, 'flat'>,
  close: number,
  highs: number[],
  lows: number[],
  lookback = 20
): { roomToRunPct: number | null; rangePosition: number | null } {
  const i = highs.length - 1
  if (i < lookback || close <= 0) return { roomToRunPct: null, rangePosition: null }
  const hh = highest(highs, lookback, i - 1)
  const ll = lowest(lows, lookback, i - 1)
  if (hh == null || ll == null) return { roomToRunPct: null, rangePosition: null }
  const range = hh - ll
  const rangePosition = range > 0 ? (close - ll) / range : null
  if (direction === 'long') {
    const roomToRunPct = ((hh - close) / close) * 100
    return { roomToRunPct: Math.max(0, roomToRunPct), rangePosition }
  }
  const roomToRunPct = ((close - ll) / close) * 100
  return { roomToRunPct: Math.max(0, roomToRunPct), rangePosition }
}

/** Retourne un signal uniquement si une stratégie dépasse le seuil directionnel minimal. */
export function analyzeCoinSnapshot(
  coin: string,
  closes: number[],
  highs: number[],
  lows: number[],
  vols: number[],
  btcRetWindow: number | null,
  barsWindow: number
): ScanSignal | null {
  if (closes.length < 60) return null
  const regime = detectRegime(closes, highs, lows)
  const { best, bestDirectionalRaw } = evaluateStrategies(closes, highs, lows, regime)
  const chosen = best ?? bestDirectionalRaw
  if (!chosen || chosen.direction === 'flat') return null
  const lastClose = closes[closes.length - 1]

  const checks = computeIndicatorChecks(chosen.direction, closes, highs, lows, vols)
  const validatedCount =
    Number(checks.ema) + Number(checks.rsi) + Number(checks.macd) + Number(checks.volume)
  const confluencePct = (validatedCount / 4) * 100

  const { roomToRunPct, rangePosition } = computeRoomMetrics(
    chosen.direction,
    lastClose,
    highs,
    lows
  )

  let relativeVsBtc: RelativeVsBtc | null = null
  const coinRet = pctReturn(closes, barsWindow)
  if (coinRet != null && btcRetWindow != null) {
    relativeVsBtc = classifyVsBtc(coinRet, btcRetWindow)
  }

  const indicatorGauges = computeIndicatorGauges(closes, highs, lows, vols)
  const scanTrend = indicatorGauges ? summarizeScanTrend(indicatorGauges) : null

  return {
    coin,
    direction: chosen.direction,
    strategyId: chosen.id,
    strategyName: chosen.name,
    weighted: chosen.weighted,
    regimeLabel: regime?.label ?? null,
    lastClose,
    confirmed: best != null,
    regimeExplanation: regime?.explanation ?? null,
    strategyReasons: [...chosen.reasons],
    checks,
    validatedCount,
    confluencePct,
    roomToRunPct,
    rangePosition,
    relativeVsBtc,
    indicatorGauges,
    scanTrend,
  }
}
