/** Chaînes prêtes pour collage dans l’UI Hyperliquid (point décimal, pas d’espaces). */

/** Taille arrondie vers le bas selon szDecimals du carnet HL. */
export function hlSizeString(units: number, szDecimals: number): string {
  if (!Number.isFinite(units) || szDecimals < 0) return ''
  const f = 10 ** szDecimals
  const v = Math.floor(units * f + Number.EPSILON) / f
  return v.toFixed(szDecimals)
}

function stripTrailingZeros(s: string): string {
  if (!s.includes('.')) return s
  const t = s.replace(/\.?0+$/, '')
  return t === '' || t === '-' ? '0' : t
}

function roundToMaxDecimals(px: number, maxDecimals: number): number {
  const f = 10 ** maxDecimals
  return Math.round(px * f + Math.sign(px) * 1e-12) / f
}

/** Au plus 5 chiffres significatifs (règle prix HL). */
function roundToSigFigs(px: number, sig: number): number {
  if (!Number.isFinite(px) || px === 0) return px
  const sign = Math.sign(px)
  const ax = Math.abs(px)
  const mag = Math.floor(Math.log10(ax))
  const scale = 10 ** (sig - 1 - mag)
  return sign * Math.round(ax * scale + 1e-12) / scale
}

/**
 * Prix pour collage ordre HL : décimales max = (6 − szDecimals) en perp / HIP-3,
 * (8 − szDecimals) en spot ; combiné avec la limite des 5 chiffres significatifs.
 */
export function hlOrderPriceString(
  px: number,
  szDecimals: number,
  isSpot: boolean
): string {
  if (!Number.isFinite(px)) return ''
  const maxDecimals = Math.max(0, (isSpot ? 8 : 6) - szDecimals)

  let q = px
  for (let i = 0; i < 12; i++) {
    const next = roundToSigFigs(roundToMaxDecimals(q, maxDecimals), 5)
    if (Math.abs(next - q) <= 1e-12 * Math.max(1, Math.abs(q))) {
      q = next
      break
    }
    q = next
  }
  q = roundToMaxDecimals(q, maxDecimals)
  return stripTrailingZeros(q.toFixed(maxDecimals))
}

export function clipLeverage(
  indicative: number,
  userMax: number,
  coinMax?: number
): number {
  let x = Math.max(1, Math.ceil(indicative))
  x = Math.min(x, Math.max(1, Math.floor(userMax)))
  if (coinMax != null && coinMax > 0) x = Math.min(x, coinMax)
  return Math.max(1, x)
}
