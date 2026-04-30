import { atr, ema, highest, lastNonNull, lowest, macd, rsi } from './indicators'

export type Direction = 'long' | 'short' | 'flat'

export type StrategyId = 'trend_ema_macd' | 'mean_reversion_rsi' | 'breakout_range'

export interface StrategyVote {
  id: StrategyId
  name: string
  direction: Direction
  /** 0–1 force du signal avant pondération régime */
  rawScore: number
  /** 0–1 adéquation au régime détecté */
  regimeFit: number
  /** rawScore * regimeFit */
  weighted: number
  reasons: string[]
}

export interface Regime {
  label: 'tendance' | 'range' | 'volatile'
  atrPct: number
  trendStrength: number
  explanation: string
}

/** Seuil minimal pour qu’un vote directionnel soit retenu (aligné sur le plan trade). */
export const STRATEGY_SIGNAL_THRESHOLD = 0.08

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

export function detectRegime(
  closes: number[],
  highs: number[],
  lows: number[]
): Regime | null {
  const n = closes.length
  if (n < 60) return null
  const a = atr(highs, lows, closes, 14)
  const e20 = ema(closes, 20)
  const e50 = ema(closes, 50)
  const atrV = lastNonNull(a)
  const c = closes[n - 1]
  const ema20 = lastNonNull(e20)
  const ema50 = lastNonNull(e50)
  if (atrV == null || ema20 == null || ema50 == null) return null
  const atrPct = atrV / c
  const trendStrength = clamp01(Math.abs(ema20 - ema50) / (atrV * 2.5))

  let label: Regime['label'] = 'range'
  let explanation =
    'Marché sans direction claire dominante ; attention aux faux breakouts.'
  if (atrPct > 0.028) {
    label = 'volatile'
    explanation =
      'Volatilité relative élevée : favoriser prudence, stops plus larges, tailles réduites.'
  } else if (trendStrength > 0.45) {
    label = 'tendance'
    explanation =
      'Écarts entre moyennes mobiles cohérents avec une tendance directionnelle.'
  }

  return { label, atrPct, trendStrength, explanation }
}

export function evaluateStrategies(
  closes: number[],
  highs: number[],
  lows: number[],
  regime: Regime | null
): {
  votes: StrategyVote[]
  best: StrategyVote | null
  bestDirectionalRaw: StrategyVote | null
} {
  const n = closes.length
  if (n < 60) return { votes: [], best: null, bestDirectionalRaw: null }

  const e20 = ema(closes, 20)
  const e50 = ema(closes, 50)
  const r = rsi(closes, 14)
  const { line: macdLine, signal: macdSig, hist } = macd(closes)
  const a = atr(highs, lows, closes, 14)

  const i = n - 1
  const price = closes[i]
  const rsiNow = r[i]
  const rsiPrev = r[i - 1]
  const ema20n = e20[i]
  const ema50n = e50[i]
  const mL = macdLine[i]
  const mS = macdSig[i]
  const mLp = macdLine[i - 1]
  const mSp = macdSig[i - 1]
  const hi = hist[i]
  const hip = hist[i - 1]
  const atrN = a[i]

  const wTrend =
    regime == null
      ? 0.55
      : regime.label === 'tendance'
        ? 0.85
        : regime.label === 'volatile'
          ? 0.35
          : 0.5
  const wMean =
    regime == null
      ? 0.5
      : regime.label === 'range'
        ? 0.85
        : regime.label === 'volatile'
          ? 0.65
          : 0.4
  const wBreak =
    regime == null
      ? 0.45
      : regime.label === 'volatile'
        ? 0.75
        : regime.label === 'tendance'
          ? 0.55
          : 0.5

  const votes: StrategyVote[] = []

  // --- Trend EMA + MACD
  {
    let direction: Direction = 'flat'
    let raw = 0
    const reasons: string[] = []
    if (
      ema20n != null &&
      ema50n != null &&
      mL != null &&
      mS != null &&
      mLp != null &&
      mSp != null &&
      hi != null &&
      hip != null
    ) {
      const bullTrend = ema20n > ema50n && price > ema20n
      const bearTrend = ema20n < ema50n && price < ema20n
      const bullMacd = mL > mS && (mL > mLp || hi > hip)
      const bearMacd = mL < mS && (mL < mLp || hi < hip)
      if (bullTrend && bullMacd) {
        direction = 'long'
        raw = 0.55 + 0.25 * (regime?.trendStrength ?? 0.35)
        reasons.push('Prix au-dessus de l’EMA20, EMA20 > EMA50')
        reasons.push('MACD au-dessus du signal avec momentum favorable')
      } else if (bearTrend && bearMacd) {
        direction = 'short'
        raw = 0.55 + 0.25 * (regime?.trendStrength ?? 0.35)
        reasons.push('Prix sous l’EMA20, EMA20 < EMA50')
        reasons.push('MACD sous le signal avec momentum favorable')
      } else {
        reasons.push('Pas d’alignement clair entre tendance EMA et MACD')
      }
    }
    votes.push({
      id: 'trend_ema_macd',
      name: 'Tendance (EMA + MACD)',
      direction,
      rawScore: clamp01(raw),
      regimeFit: wTrend,
      weighted: clamp01(raw) * wTrend,
      reasons,
    })
  }

  // --- Mean reversion RSI
  {
    let direction: Direction = 'flat'
    let raw = 0
    const reasons: string[] = []
    if (rsiNow != null && rsiPrev != null) {
      if (rsiNow < 36 && rsiNow > rsiPrev) {
        direction = 'long'
        raw = clamp01((36 - rsiNow) / 36 + 0.25)
        reasons.push(`RSI bas (${rsiNow.toFixed(1)}) avec rebond intrabar`)
      } else if (rsiNow > 64 && rsiNow < rsiPrev) {
        direction = 'short'
        raw = clamp01((rsiNow - 64) / 36 + 0.25)
        reasons.push(`RSI élevé (${rsiNow.toFixed(1)}) avec refroidissement`)
      } else {
        reasons.push(`RSI neutre (${rsiNow.toFixed(1)}) — pas d’excès exploitable`)
      }
    }
    votes.push({
      id: 'mean_reversion_rsi',
      name: 'Contre-tendance (RSI)',
      direction,
      rawScore: raw,
      regimeFit: wMean,
      weighted: raw * wMean,
      reasons,
    })
  }

  // --- Breakout ATR sur range 20 bougies
  {
    let direction: Direction = 'flat'
    let raw = 0
    const reasons: string[] = []
    const hh = highest(highs, 20, i - 1)
    const ll = lowest(lows, 20, i - 1)
    if (hh != null && ll != null && atrN != null) {
      const thr = atrN * 0.15
      if (price > hh + thr) {
        direction = 'long'
        raw = clamp01((price - hh) / atrN)
        reasons.push(`Cassure au-dessus du plus haut 20 bougies (+ buffer ATR)`)
      } else if (price < ll - thr) {
        direction = 'short'
        raw = clamp01((ll - price) / atrN)
        reasons.push(`Cassure sous le plus bas 20 bougies (− buffer ATR)`)
      } else {
        reasons.push('Prix dans le range récent — pas de breakout validé')
      }
    }
    votes.push({
      id: 'breakout_range',
      name: 'Breakout (range 20 + ATR)',
      direction,
      rawScore: raw,
      regimeFit: wBreak,
      weighted: raw * wBreak,
      reasons,
    })
  }

  const directionalVotes = votes.filter((v) => v.direction !== 'flat')
  const bestDirectionalRaw =
    directionalVotes.length === 0
      ? null
      : directionalVotes.reduce((a, b) => (a.weighted >= b.weighted ? a : b))

  const valid = votes.filter(
    (v) => v.direction !== 'flat' && v.weighted > STRATEGY_SIGNAL_THRESHOLD
  )
  const best =
    valid.length === 0
      ? null
      : valid.reduce((a, b) => (a.weighted >= b.weighted ? a : b))

  return { votes, best, bestDirectionalRaw }
}
