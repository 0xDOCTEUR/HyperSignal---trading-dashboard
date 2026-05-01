import type { ScannerAsset } from './marketTypes'
import { buildSpotTokenMap, resolveSpotDisplayLabel } from './spotLabels'
import type { HlInterval } from './interval'

/** Bougie renvoyée par REST ou WS (champs normalisés). */
export interface HlCandle {
  t: number
  T: number
  o: number
  h: number
  l: number
  c: number
  v: number
  n: number
  s: string
  i: string
}

function num(x: string | number): number {
  return typeof x === 'number' ? x : parseFloat(x)
}

export function normalizeRestCandle(raw: Record<string, unknown>): HlCandle {
  return {
    t: Number(raw.t),
    T: Number(raw.T),
    o: num(raw.o as string | number),
    h: num(raw.h as string | number),
    l: num(raw.l as string | number),
    c: num(raw.c as string | number),
    v: num(raw.v as string | number),
    n: Number(raw.n),
    s: String(raw.s),
    i: String(raw.i),
  }
}

export function normalizeWsCandle(raw: Record<string, unknown>): HlCandle {
  return normalizeRestCandle(raw)
}

const HL_INFO_URL =
  import.meta.env.DEV ? '/hyperliquid-info' : 'https://api.hyperliquid.xyz/info'

/** Évite les rafales vers `/info` (429 Too Many Requests). Plan MTF = jusqu’à 7 candleSnapshot en parallèle. */
const HL_INFO_MAX_PARALLEL = 8
const HL_INFO_MAX_RETRIES = 8
const HL_INFO_RETRY_BASE_MS = 550
const HL_INFO_RETRY_CAP_MS = 28_000

class HlInfoSemaphore {
  private active = 0
  private readonly queue: Array<() => void> = []
  private readonly max: number

  constructor(max: number) {
    this.max = max
  }

  acquire(): Promise<void> {
    return new Promise((resolve) => {
      const tryRun = () => {
        if (this.active < this.max) {
          this.active++
          resolve()
        } else {
          this.queue.push(() => {
            this.active++
            resolve()
          })
        }
      }
      tryRun()
    })
  }

  release(): void {
    this.active--
    const next = this.queue.shift()
    if (next) next()
  }
}

const hlInfoSemaphore = new HlInfoSemaphore(HL_INFO_MAX_PARALLEL)

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Durée suggérée par le serveur avant un nouveau POST `/info`. */
function parseRetryAfterMs(headers: Headers): number | null {
  const ra = headers.get('retry-after')
  if (!ra) return null
  const sec = parseInt(ra.trim(), 10)
  if (Number.isFinite(sec) && sec >= 0) return Math.min(sec * 1000, 120_000)
  const when = Date.parse(ra)
  if (Number.isFinite(when)) return Math.min(Math.max(0, when - Date.now()), 120_000)
  return null
}

function hlInfoOpLabel(body: unknown): string {
  if (body && typeof body === 'object' && 'type' in body) {
    const t = (body as { type?: unknown }).type
    if (typeof t === 'string') return t
  }
  return 'info'
}

async function hlInfoPost(body: Record<string, unknown>): Promise<Response> {
  await hlInfoSemaphore.acquire()
  try {
    const label = hlInfoOpLabel(body)
    let attempt = 0
    while (true) {
      attempt++
      const res = await fetch(HL_INFO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) return res

      const status = res.status
      const retryAfterMs = parseRetryAfterMs(res.headers)
      const text = await res.text()

      const retriable =
        status === 429 || status === 503 || status === 502 || status === 408
      if (retriable && attempt < HL_INFO_MAX_RETRIES) {
        const backoff = Math.min(
          HL_INFO_RETRY_BASE_MS * 2 ** (attempt - 1) + Math.random() * 350,
          HL_INFO_RETRY_CAP_MS
        )
        await sleepMs(Math.max(retryAfterMs ?? 0, backoff))
        continue
      }

      const hint =
        status === 429
          ? ' — limite Hyperliquid (429). Réessayez dans une minute ou désactivez le scan auto.'
          : ''
      throw new Error(`${label} ${status}: ${text.slice(0, 200)}${hint}`)
    }
  } finally {
    hlInfoSemaphore.release()
  }
}

/** Quelques marchés HIP-3 courants — complète dans l’onglet (stocké localement). */
export const HIP3_PRESET_LINES = ['xyz:BRENTOIL', 'xyz:XAU', 'xyz:XAG'].join('\n')

/** Perps HL core + précisions officielles. */
export async function fetchPerpUniverse(): Promise<ScannerAsset[]> {
  const res = await hlInfoPost({ type: 'metaAndAssetCtxs' })
  const raw = (await res.json()) as unknown
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error('Réponse meta invalide')
  }
  const meta = raw[0] as { universe?: unknown[] }
  const ctxs = raw[1] as Record<string, unknown>[]
  const universe = meta.universe ?? []
  const out: ScannerAsset[] = []

  for (let i = 0; i < universe.length; i++) {
    const u = universe[i] as Record<string, unknown>
    const ctx = ctxs[i] as Record<string, unknown> | undefined
    const name = String(u.name ?? '')
    if (!name || u.isDelisted === true) continue
    const maxLeverage = typeof u.maxLeverage === 'number' ? u.maxLeverage : 1
    const szDecimals = typeof u.szDecimals === 'number' ? u.szDecimals : 5
    const volRaw = ctx?.dayNtlVlm
    const dayNtlVlm =
      volRaw !== undefined ? parseFloat(String(volRaw)) || 0 : 0
    out.push({ name, maxLeverage, dayNtlVlm, szDecimals })
  }

  return out
}

/** Spot HL (@universe spotMetaAndAssetCtxs). */
export async function fetchSpotUniverse(): Promise<ScannerAsset[]> {
  const res = await hlInfoPost({ type: 'spotMetaAndAssetCtxs' })
  const raw = (await res.json()) as unknown
  if (!Array.isArray(raw) || raw.length < 2) return []

  const meta = raw[0] as {
    universe?: Array<{ name?: string; tokens?: number[] }>
    tokens?: Array<{ index?: number; szDecimals?: number; name?: string }>
  }
  const ctxs = raw[1] as Record<string, unknown>[]

  const tokenByIndex = buildSpotTokenMap(meta.tokens ?? [])

  const universe = meta.universe ?? []
  const out: ScannerAsset[] = []

  for (let i = 0; i < universe.length; i++) {
    const u = universe[i]
    const ctx = ctxs[i]
    const universeName = u?.name != null ? String(u.name).trim() : ''
    const ctxCoin = ctx?.coin != null ? String(ctx.coin).trim() : ''
    /** Identifiant attendu par candleSnapshot / carnet (souvent @index ou BASE/QUOTE). */
    const hlSymbol = ctxCoin || universeName
    if (!hlSymbol) continue

    const pretty = resolveSpotDisplayLabel({
      universeName,
      ctxCoin,
      tokenIndices: u?.tokens,
      tokenByIndex,
    }).trim()

    const ti = u?.tokens?.[0]
    const tok = typeof ti === 'number' ? tokenByIndex.get(ti) : undefined
    const szDecimals = tok?.szDecimals ?? 6
    const volRaw = ctx?.dayNtlVlm
    const dayNtlVlm =
      volRaw !== undefined ? parseFloat(String(volRaw)) || 0 : 0

    const displayName =
      pretty && pretty !== hlSymbol ? pretty : undefined

    out.push({
      name: hlSymbol,
      displayName,
      dayNtlVlm,
      szDecimals,
    })
  }

  return out
}

export async function fetchCandleSnapshot(params: {
  coin: string
  interval: HlInterval
  startTime: number
  endTime: number
}): Promise<HlCandle[]> {
  const res = await hlInfoPost({
    type: 'candleSnapshot',
    req: {
      coin: params.coin,
      interval: params.interval,
      startTime: params.startTime,
      endTime: params.endTime,
    },
  })
  const raw = await res.json() as unknown
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw.map((row) => normalizeRestCandle(row as Record<string, unknown>))
  }
  if (typeof raw === 'object' && raw !== null && 'error' in raw) {
    throw new Error(String((raw as { error?: unknown }).error ?? 'candleSnapshot error'))
  }
  return []
}

function hlParseUsd(v: unknown): number | null {
  if (v == null) return null
  const n = parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

/** Résumé marges renvoyé par clearinghouseState (perps). */
export interface HlClearinghouseSummary {
  accountValueUsd: number | null
  totalMarginUsedUsd: number | null
  withdrawableUsd: number | null
}

/** Une ligne de position perp (données publiques pour une adresse donnée). */
export interface HlPerpPositionRow {
  coin: string
  /** Positif = long, négatif = short */
  szi: number
  entryPx: number | null
  positionValueUsd: number | null
  unrealizedPnlUsd: number | null
  liquidationPx: number | null
  leverageType: string | null
  leverageValue: number | null
  /** Prix indicatif ≈ valeur notionnelle / |taille| (pour aide à la lecture sans appel séparé). */
  approxMarkPx: number | null
}

export function normalizeHlWallet(address: string): string | null {
  const u = address.trim().toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(u) ? u : null
}

/** Distance prix → liquidation en % (approximation avec un prix mark / dernier close). */
export function distanceToLiquidationPct(args: {
  direction: 'long' | 'short'
  markPx: number
  liquidationPx: number | null
}): number | null {
  const { direction, markPx, liquidationPx } = args
  if (liquidationPx == null || markPx <= 0 || liquidationPx <= 0) return null
  if (direction === 'long') return ((markPx - liquidationPx) / markPx) * 100
  return ((liquidationPx - markPx) / markPx) * 100
}

/**
 * Variation de prix « favorable » au sens de la position (% vs entrée).
 * Positif ≈ mouvement qui augmente le gain latent pour ce sens (long ou short).
 */
export function pctFavorableVsEntry(args: {
  direction: 'long' | 'short'
  entryPx: number | null
  markPx: number | null
}): number | null {
  const { direction, entryPx, markPx } = args
  if (entryPx == null || entryPx <= 0 || markPx == null || markPx <= 0) return null
  if (direction === 'long') return ((markPx - entryPx) / entryPx) * 100
  return ((entryPx - markPx) / entryPx) * 100
}

/** Mid carnet (~temps réel) pour les perps du DEX principal. Clés = symboles type BTC, ETH… */
export async function fetchAllPerpMids(dex = ''): Promise<Map<string, number>> {
  const res = await hlInfoPost({ type: 'allMids', dex })
  const raw = await res.json()
  const m = new Map<string, number>()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return m
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k.startsWith('@')) continue
    const n = hlParseUsd(v)
    if (n != null && n > 0) m.set(k, n)
  }
  return m
}

export interface TrackedHlPositionRow extends HlPerpPositionRow {
  /** Mid Hyperliquid (`allMids`) ; peut être null si indispo. */
  liveMidPx: number | null
}

/**
 * État du clearinghouse pour une adresse — **aucune signature**, lecture API uniquement.
 * @see https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals
 */
export async function fetchClearinghouseState(walletAddress: string): Promise<{
  summary: HlClearinghouseSummary | null
  positions: HlPerpPositionRow[]
  serverTimeMs: number | null
}> {
  const user = normalizeHlWallet(walletAddress)
  if (!user) throw new Error('Adresse wallet invalide (attendu : 0x + 40 caractères hex).')

  const res = await hlInfoPost({ type: 'clearinghouseState', user })
  const raw = (await res.json()) as Record<string, unknown>

  const summaryPanel =
    raw.marginSummary && typeof raw.marginSummary === 'object'
      ? (raw.marginSummary as Record<string, unknown>)
      : null

  const summary: HlClearinghouseSummary | null = summaryPanel
    ? {
        accountValueUsd: hlParseUsd(summaryPanel.accountValue),
        totalMarginUsedUsd: hlParseUsd(summaryPanel.totalMarginUsed),
        withdrawableUsd: hlParseUsd(raw.withdrawable),
      }
    : {
        accountValueUsd: null,
        totalMarginUsedUsd: null,
        withdrawableUsd: hlParseUsd(raw.withdrawable),
      }

  const positionsOut: HlPerpPositionRow[] = []
  const assetPositions = raw.assetPositions
  if (Array.isArray(assetPositions)) {
    for (const wrap of assetPositions) {
      if (!wrap || typeof wrap !== 'object') continue
      const pos = (wrap as Record<string, unknown>).position as Record<string, unknown> | undefined
      if (!pos || typeof pos !== 'object') continue

      const coin = String(pos.coin ?? '').trim()
      if (!coin) continue

      const szi = hlParseUsd(pos.szi)
      if (szi == null || Math.abs(szi) < 1e-12) continue

      const positionValueUsd = hlParseUsd(pos.positionValue)
      const absSz = Math.abs(szi)
      const approxMarkPx =
        positionValueUsd != null && absSz > 1e-12 ? Math.abs(positionValueUsd / absSz) : null

      let levType: string | null = null
      let levVal: number | null = null
      const lev = pos.leverage
      if (lev && typeof lev === 'object') {
        const lo = lev as Record<string, unknown>
        levType = lo.type != null ? String(lo.type) : null
        levVal =
          typeof lo.value === 'number'
            ? lo.value
            : lo.value != null
              ? hlParseUsd(lo.value)
              : null
      }

      positionsOut.push({
        coin,
        szi,
        entryPx: hlParseUsd(pos.entryPx),
        positionValueUsd,
        unrealizedPnlUsd: hlParseUsd(pos.unrealizedPnl),
        liquidationPx: hlParseUsd(pos.liquidationPx),
        leverageType: levType,
        leverageValue: levVal,
        approxMarkPx,
      })
    }
  }

  const serverTimeMs =
    typeof raw.time === 'number' && Number.isFinite(raw.time) ? raw.time : null

  return { summary, positions: positionsOut, serverTimeMs }
}

const WS_URL = 'wss://api.hyperliquid.xyz/ws'

export function subscribeHlCandles(
  coin: string,
  interval: HlInterval,
  onCandle: (c: HlCandle) => void,
  onStatus?: (s: 'open' | 'close' | 'error', err?: Event) => void
): () => void {
  const ws = new WebSocket(WS_URL)
  ws.onopen = () => {
    onStatus?.('open')
    ws.send(
      JSON.stringify({
        method: 'subscribe',
        subscription: { type: 'candle', coin, interval },
      })
    )
  }
  ws.onerror = (e) => onStatus?.('error', e)
  ws.onclose = () => onStatus?.('close')
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string) as Record<string, unknown>
      if (msg.channel === 'subscriptionResponse') return
      if (msg.channel !== 'candle') return
      const d = msg.data
      const rows = Array.isArray(d)
        ? (d as Record<string, unknown>[])
        : d && typeof d === 'object'
          ? [d as Record<string, unknown>]
          : []
      for (const row of rows) onCandle(normalizeWsCandle(row))
    } catch {
      /* ignore */
    }
  }
  return () => {
    try {
      ws.close()
    } catch {
      /* ignore */
    }
  }
}
