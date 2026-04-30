/** Libellé lisible pour une ligne spot HL (universe + assetCtx). */

export type SpotTokenMeta = { index: number; name: string; szDecimals: number }

export function buildSpotTokenMap(
  tokens: Array<{ index?: number; name?: string; szDecimals?: number }>
): Map<number, SpotTokenMeta> {
  const m = new Map<number, SpotTokenMeta>()
  for (const t of tokens) {
    const idx = t.index
    if (typeof idx !== 'number') continue
    m.set(idx, {
      index: idx,
      name: typeof t.name === 'string' ? t.name : '',
      szDecimals: typeof t.szDecimals === 'number' ? t.szDecimals : 6,
    })
  }
  return m
}

export function resolveSpotDisplayLabel(params: {
  universeName: string
  ctxCoin: string
  tokenIndices: number[] | undefined
  tokenByIndex: Map<number, SpotTokenMeta>
}): string {
  const { universeName: uRaw, ctxCoin: cRaw, tokenIndices, tokenByIndex } = params
  const u = uRaw.trim()
  const c = cRaw.trim()

  if (u.includes('/')) return u

  if (tokenIndices && tokenIndices.length >= 2) {
    const base = tokenByIndex.get(tokenIndices[0])
    const quote = tokenByIndex.get(tokenIndices[1])
    if (base?.name && quote?.name) return `${base.name}/${quote.name}`
  }

  const fromAtNotation = (s: string): string | null => {
    const m = /^@(\d+)$/.exec(s)
    if (!m) return null
    const idx = parseInt(m[1], 10)
    const tok = tokenByIndex.get(idx)
    if (!tok?.name) return null
    return `${tok.name}/USDC`
  }

  const hitC = fromAtNotation(c)
  if (hitC) return hitC

  const hitU = fromAtNotation(u)
  if (hitU) return hitU

  if (tokenIndices?.length === 1) {
    const base = tokenByIndex.get(tokenIndices[0])
    if (base?.name) return `${base.name}/USDC`
  }

  return c || u
}
