export type MarketTab = 'perps' | 'spot' | 'hip3'

export interface ScannerAsset {
  /** Identifiant HL pour candles / ordres (ex. BTC, xyz:XAU, @150). */
  name: string
  /** Libellé UI pour spot quand `name` est une notation @index — sinon absent. */
  displayName?: string
  dayNtlVlm: number
  szDecimals: number
  /** Levier max du marché (perp / HIP-3), absent pour spot si inconnu */
  maxLeverage?: number
}

export function assetLabel(a: ScannerAsset): string {
  return a.displayName ?? a.name
}

/** Libellé paire pour un symbole HL connu dans la liste chargée. */
export function pairUiLabel(assets: ScannerAsset[], hlCoin: string): string {
  const a = assets.find((x) => x.name === hlCoin)
  return a ? assetLabel(a) : hlCoin
}
