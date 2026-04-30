export function ema(series: number[], period: number): (number | null)[] {
  if (period <= 0 || series.length === 0) return series.map(() => null)
  const k = 2 / (period + 1)
  const out: (number | null)[] = series.map(() => null)
  let sum = 0
  for (let i = 0; i < period && i < series.length; i++) sum += series[i]
  if (series.length < period) return out
  let prev = sum / period
  out[period - 1] = prev
  for (let i = period; i < series.length; i++) {
    prev = series[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

export function rsi(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = closes.map(() => null)
  if (closes.length <= period) return out
  let gains = 0
  let losses = 0
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1]
    if (ch >= 0) gains += ch
    else losses -= ch
  }
  let avgGain = gains / period
  let avgLoss = losses / period
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
  out[period] = 100 - 100 / (1 + rs)
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1]
    const g = ch > 0 ? ch : 0
    const l = ch < 0 ? -ch : 0
    avgGain = (avgGain * (period - 1) + g) / period
    avgLoss = (avgLoss * (period - 1) + l) / period
    const rs2 = avgLoss === 0 ? 100 : avgGain / avgLoss
    out[i] = 100 - 100 / (1 + rs2)
  }
  return out
}

export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): (number | null)[] {
  const tr: number[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      tr.push(highs[i] - lows[i])
      continue
    }
    const a = highs[i] - lows[i]
    const b = Math.abs(highs[i] - closes[i - 1])
    const c = Math.abs(lows[i] - closes[i - 1])
    tr.push(Math.max(a, b, c))
  }
  const out: (number | null)[] = tr.map(() => null)
  if (tr.length < period) return out
  let sum = 0
  for (let i = 0; i < period; i++) sum += tr[i]
  let prev = sum / period
  out[period - 1] = prev
  for (let i = period; i < tr.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period
    out[i] = prev
  }
  return out
}

/** MACD classique : ligne = EMA12 − EMA26, signal = EMA9 de la ligne. */
export function macd(
  closes: number[]
): {
  line: (number | null)[]
  signal: (number | null)[]
  hist: (number | null)[]
} {
  const e12 = ema(closes, 12)
  const e26 = ema(closes, 26)
  const line: (number | null)[] = closes.map((_, i) =>
    e12[i] != null && e26[i] != null ? e12[i]! - e26[i]! : null
  )
  const first = line.findIndex((x) => x != null)
  const signal: (number | null)[] = closes.map(() => null)
  if (first >= 0) {
    const sub = line.slice(first).map((x) => x!)
    const sigSub = ema(sub, 9)
    for (let j = 0; j < sigSub.length; j++) signal[first + j] = sigSub[j]
  }
  const hist = line.map((m, i) =>
    m != null && signal[i] != null ? m - signal[i]! : null
  )
  return { line, signal, hist }
}

export function highest(arr: number[], lookback: number, end: number): number | null {
  const start = end - lookback + 1
  if (start < 0) return null
  let m = arr[start]
  for (let i = start + 1; i <= end; i++) m = Math.max(m, arr[i])
  return m
}

export function lowest(arr: number[], lookback: number, end: number): number | null {
  const start = end - lookback + 1
  if (start < 0) return null
  let m = arr[start]
  for (let i = start + 1; i <= end; i++) m = Math.min(m, arr[i])
  return m
}

export function lastNonNull<T>(arr: (T | null)[]): T | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return arr[i] as T
  }
  return null
}
