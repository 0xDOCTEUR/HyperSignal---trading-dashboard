/**
 * Taille indicative : montant risqué = equity * riskPct/100
 * arrêt = atr * multiple (en points de prix).
 * unités ≈ riskAmount / stopDistance (notional ≈ unités * prix).
 */
export function suggestPosition(params: {
  equityUsd: number
  riskPct: number
  price: number
  atr: number
  atrStopMultiple: number
}): {
  riskUsd: number
  stopDistance: number
  units: number
  notionalUsd: number
} | null {
  const { equityUsd, riskPct, price, atr, atrStopMultiple } = params
  if (
    equityUsd <= 0 ||
    riskPct <= 0 ||
    price <= 0 ||
    atr <= 0 ||
    atrStopMultiple <= 0
  ) {
    return null
  }
  const riskUsd = (equityUsd * riskPct) / 100
  const stopDistance = atr * atrStopMultiple
  const units = riskUsd / stopDistance
  const notionalUsd = units * price
  return { riskUsd, stopDistance, units, notionalUsd }
}

/** Même logique avec une distance de stop déjà calculée (prix absolu). */
export function suggestPositionFromStopDistance(params: {
  equityUsd: number
  riskPct: number
  entryPrice: number
  stopDistancePrice: number
}): {
  riskUsd: number
  stopDistancePrice: number
  units: number
  notionalUsd: number
} | null {
  const { equityUsd, riskPct, entryPrice, stopDistancePrice } = params
  if (
    equityUsd <= 0 ||
    riskPct <= 0 ||
    entryPrice <= 0 ||
    stopDistancePrice <= 0
  ) {
    return null
  }
  const riskUsd = (equityUsd * riskPct) / 100
  const units = riskUsd / stopDistancePrice
  const notionalUsd = units * entryPrice
  return { riskUsd, stopDistancePrice, units, notionalUsd }
}
