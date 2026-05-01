/** Intervalles supportés par Hyperliquid (voir docs officielles). */
export const HL_INTERVALS = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
] as const

export type HlInterval = (typeof HL_INTERVALS)[number]

/**
 * Intervalles proposés dans l’UI pour Plan + Opportunités uniquement (réduit la confusion).
 * Les autres UT HL restent utilisables en interne si besoin.
 */
export const PLAN_SCAN_INTERVALS = ['5m', '15m', '1h', '4h'] as const satisfies readonly HlInterval[]

/** UT proposées pour le Plan : niveaux entrée / SL / TP (alignées sur la pyramide multi‑TF). */
export const PLAN_LEVELS_INTERVALS = [
  '1m',
  '5m',
  '15m',
  '1h',
  '4h',
  '1d',
  '1w',
] as const satisfies readonly HlInterval[]

/**
 * Horizons pour confluence, pastilles Plan et comptage d’alignement Opportunités.
 * Sans 1m : trop de bruit microstructure qui contredit souvent les UT de décision.
 */
export const MTF_SYNTHESIS_TF_ORDER = [
  '5m',
  '15m',
  '1h',
  '4h',
  '1d',
  '1w',
] as const satisfies readonly HlInterval[]

export type PlanLevelsInterval = (typeof PLAN_LEVELS_INTERVALS)[number]

export function isPlanLevelsInterval(iv: string): iv is PlanLevelsInterval {
  return (PLAN_LEVELS_INTERVALS as readonly string[]).includes(iv)
}

export function intervalToMs(interval: string): number {
  const map: Record<string, number> = {
    '1m': 60_000,
    '3m': 180_000,
    '5m': 300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h': 3_600_000,
    '2h': 7_200_000,
    '4h': 14_400_000,
    '8h': 28_800_000,
    '12h': 43_200_000,
    '1d': 86_400_000,
    '3d': 259_200_000,
    '1w': 604_800_000,
    '1M': 2_592_000_000,
  }
  return map[interval] ?? 60_000
}
