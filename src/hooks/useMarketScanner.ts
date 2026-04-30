import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchCandleSnapshot } from '../lib/hyperliquid'
import type { ScannerAsset } from '../lib/marketTypes'
import { intervalToMs, type HlInterval } from '../lib/interval'
import {
  analyzeCoinSnapshot,
  candlesToOHLC,
  compareScanOpportunities,
  MIN_SCAN_CONFLUENCE_PCT,
  type ScanSignal,
} from '../lib/scanMarket'
import type { TradabilityScannerParams, ScanCandidate } from '../lib/tradability'
import { assessTradabilityAsync } from '../lib/tradability'
import { translate } from '../i18n/dict'
import type { Locale } from '../i18n/locale'

/**
 * Profil scan « rapide et efficace » :
 * — périmètre = forte liquidité HL ;
 * — bougies scan compactes mais au‑delà du minimum indicateurs ;
 * — multi‑TF uniquement sur les meilleurs setups après tri ;
 * — arrêt dès assez d’opportunités listées (meilleurs traités en premier).
 */
const MAX_BARS = 200
/** Réduit les rafales vers `/info` (429). */
const SCAN_CHUNK = 3
/** Parallèle « tradable » : chaque candidat ≈ 4 snapshots MTF légers. */
const TRADABILITY_CONCURRENCY = 3

/** Périmètre bougies : tri volume 24h HL. */
export const SCAN_TOP_PAIRS_BY_VOLUME = 64

/** Borne la file multi‑TF (coûteux) après tri qualité scanner. */
export const SCAN_MAX_MTFCHECK = 28

/** Arrêt anticipé multi‑TF une fois ce nombre d’opportunités validées. */
export const SCAN_LISTED_SOFT_CAP = 18

async function filterTradableSignals(
  candidates: ScanCandidate[],
  params: TradabilityScannerParams,
  opts?: {
    onChunkDone?: (done: number, total: number) => void
    listedSoftCap?: number
  }
): Promise<{ signals: ScanSignal[]; mtfProcessed: number; stoppedAfterEnoughListed: boolean }> {
  const out: ScanSignal[] = []
  const total = candidates.length
  const cap = opts?.listedSoftCap
  let mtfProcessed = 0
  let stoppedAfterEnoughListed = false

  if (total === 0) {
    return { signals: [], mtfProcessed: 0, stoppedAfterEnoughListed: false }
  }

  for (let i = 0; i < candidates.length; i += TRADABILITY_CONCURRENCY) {
    const slice = candidates.slice(i, i + TRADABILITY_CONCURRENCY)
    const flags = await Promise.all(slice.map((c) => assessTradabilityAsync(c, params)))
    for (let j = 0; j < slice.length; j++) {
      if (flags[j]) out.push(slice[j].signal)
    }
    mtfProcessed += slice.length
    opts?.onChunkDone?.(mtfProcessed, total)

    if (cap != null && out.length >= cap) {
      stoppedAfterEnoughListed = mtfProcessed < total
      if (stoppedAfterEnoughListed) opts?.onChunkDone?.(total, total)
      break
    }
  }

  return { signals: out, mtfProcessed, stoppedAfterEnoughListed }
}

/** Avancement du scan (typiquement une à quelques minutes selon réseau et nombre de candidats). */
export type MarketScanProgress =
  | { phase: 'candles'; done: number; total: number }
  | { phase: 'tradability'; done: number; total: number }

export interface MarketScanLastSummary {
  pairsScanned: number
  /** Candidats avec confluence OK dans le périmètre volume. */
  afterConfluence: number
  /** File multi‑TF (meilleurs setups, ≤ SCAN_MAX_MTFCHECK). */
  mtfQueued: number
  /** Vérifs MTF réellement faites (≤ mtfQueued si arrêt anticipé). */
  mtfProcessed: number
  listed: number
  /** True si arrêt après SCAN_LISTED_SOFT_CAP opportunités valides. */
  stoppedAfterEnoughListed: boolean
}
export const SCAN_INTERVAL_MS = 120_000

/** Ré-export pour l’UI (seuil liste Opportunités). */
export { MIN_SCAN_CONFLUENCE_PCT }

function topVolumeNames(assets: ScannerAsset[], n: number): string[] {
  const anyVol = assets.some((a) => a.dayNtlVlm > 0)
  if (!anyVol) return assets.slice(0, n).map((a) => a.name)
  return [...assets]
    .sort((a, b) => b.dayNtlVlm - a.dayNtlVlm)
    .slice(0, n)
    .map((x) => x.name)
}

/** Scanner automatique sur le top volume perpetuel HL (pas de sélection manuelle). */
export function useMarketScanner(
  scanInterval: HlInterval,
  assets: ScannerAsset[],
  tradabilityParams: TradabilityScannerParams,
  locale: Locale
) {
  /** Top liquidité HL, plafonné pour garder un scan réactif. */
  const scanCoins = useMemo(
    () => topVolumeNames(assets, Math.min(SCAN_TOP_PAIRS_BY_VOLUME, assets.length)),
    [assets]
  )

  const [signals, setSignals] = useState<ScanSignal[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanErr, setScanErr] = useState<string | null>(null)
  const [lastScanAt, setLastScanAt] = useState<number | null>(null)
  const [scanProgress, setScanProgress] = useState<MarketScanProgress | null>(null)
  const [scanLastSummary, setScanLastSummary] = useState<MarketScanLastSummary | null>(null)
  const [autoScan, setAutoScan] = useState(false)
  const scanBusyRef = useRef(false)

  const assetMap = useMemo(() => {
    const m = new Map<string, ScannerAsset>()
    for (const a of assets) m.set(a.name, a)
    return m
  }, [assets])

  const runScan = useCallback(async () => {
    const coins = scanCoins
    if (coins.length === 0) {
      setSignals([])
      setScanErr(translate(locale, 'scan.universeUnavailable'))
      return
    }
    if (scanBusyRef.current) return
    scanBusyRef.current = true

    setScanning(true)
    setScanErr(null)
    setScanProgress({ phase: 'candles', done: 0, total: coins.length })
    const end = Date.now()
    const ms = intervalToMs(scanInterval)
    const startTime = end - ms * MAX_BARS
    const barsWindow = Math.max(2, Math.ceil(86_400_000 / ms))

    let btcRetWindow: number | null = null
    try {
      const btcSnap = await fetchCandleSnapshot({
        coin: 'BTC',
        interval: scanInterval,
        startTime,
        endTime: end,
      })
      const { closes: bc } = candlesToOHLC(btcSnap)
      const cn = bc.length
      if (cn >= barsWindow + 1) {
        const from = bc[cn - 1 - barsWindow]
        const to = bc[cn - 1]
        if (from != null && from !== 0) btcRetWindow = (to - from) / from
      }
    } catch {
      btcRetWindow = null
    }

    const collected: ScanCandidate[] = []

    try {
      for (let i = 0; i < coins.length; i += SCAN_CHUNK) {
        const slice = coins.slice(i, i + SCAN_CHUNK)
        const batch = await Promise.all(
          slice.map(async (c) => {
            try {
              const candles = await fetchCandleSnapshot({
                coin: c,
                interval: scanInterval,
                startTime,
                endTime: end,
              })
              const { closes, highs, lows, vols } = candlesToOHLC(candles)
              const signal = analyzeCoinSnapshot(
                c,
                closes,
                highs,
                lows,
                vols,
                btcRetWindow,
                barsWindow
              )
              if (!signal || signal.confluencePct < MIN_SCAN_CONFLUENCE_PCT) return null
              return { signal, closes, highs, lows } satisfies ScanCandidate
            } catch {
              return null
            }
          })
        )
        for (const item of batch) {
          if (item) collected.push(item)
        }
        setScanProgress({
          phase: 'candles',
          done: Math.min(i + slice.length, coins.length),
          total: coins.length,
        })
      }

      collected.sort((a, b) => compareScanOpportunities(a.signal, b.signal))
      const totalAfterConfluence = collected.length
      const forTradability =
        collected.length <= SCAN_MAX_MTFCHECK ? collected : collected.slice(0, SCAN_MAX_MTFCHECK)

      let tradable: ScanSignal[] = []
      let mtfProcessed = 0
      let stoppedAfterEnoughListed = false

      if (forTradability.length > 0) {
        setScanProgress({ phase: 'tradability', done: 0, total: forTradability.length })
        const r = await filterTradableSignals(forTradability, tradabilityParams, {
          listedSoftCap: SCAN_LISTED_SOFT_CAP,
          onChunkDone: (done, total) => {
            setScanProgress({ phase: 'tradability', done, total })
          },
        })
        tradable = r.signals
        mtfProcessed = r.mtfProcessed
        stoppedAfterEnoughListed = r.stoppedAfterEnoughListed
      }

      tradable.sort(compareScanOpportunities)
      setSignals(tradable)
      setLastScanAt(Date.now())
      setScanLastSummary({
        pairsScanned: coins.length,
        afterConfluence: totalAfterConfluence,
        mtfQueued: forTradability.length,
        mtfProcessed,
        listed: tradable.length,
        stoppedAfterEnoughListed,
      })
    } catch (e: unknown) {
      setScanErr(e instanceof Error ? e.message : String(e))
    } finally {
      setScanning(false)
      setScanProgress(null)
      scanBusyRef.current = false
    }
  }, [scanCoins, scanInterval, tradabilityParams, locale])

  /** Scan initial et à chaque changement d’univers / intervalle — Opportunités sans clic obligatoire. */
  useEffect(() => {
    if (scanCoins.length === 0) return
    const id = window.setTimeout(() => {
      void runScan()
    }, 0)
    return () => window.clearTimeout(id)
  }, [scanCoins, scanInterval, runScan])

  /** Rafraîchissement périodique uniquement si « Auto scan » est coché. */
  useEffect(() => {
    if (!autoScan) return
    void runScan()
    const id = window.setInterval(() => void runScan(), SCAN_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [autoScan, runScan])

  const topPick = signals[0] ?? null

  return {
    scanCoins,
    signals,
    topPick,
    scanning,
    scanErr,
    lastScanAt,
    scanProgress,
    scanLastSummary,
    runScan,
    autoScan,
    setAutoScan,
    assetMap,
  }
}
