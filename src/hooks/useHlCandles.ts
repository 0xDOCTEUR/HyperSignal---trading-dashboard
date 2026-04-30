import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HlCandle } from '../lib/hyperliquid'
import { fetchCandleSnapshot, subscribeHlCandles } from '../lib/hyperliquid'
import type { HlInterval } from '../lib/interval'
import { intervalToMs } from '../lib/interval'

function mergeSorted(uniqueByTime: Map<number, HlCandle>): HlCandle[] {
  return [...uniqueByTime.values()].sort((a, b) => a.t - b.t)
}

const EMPTY_OHLC = {
  opens: [] as number[],
  highs: [] as number[],
  lows: [] as number[],
  closes: [] as number[],
  vols: [] as number[],
  last: undefined as HlCandle | undefined,
}

export function useHlCandles(
  coin: string,
  interval: HlInterval,
  opts?: { enabled?: boolean; maxBars?: number }
) {
  const enabled = opts?.enabled ?? true
  const maxBars = opts?.maxBars ?? 400

  const [candles, setCandles] = useState<HlCandle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wsState, setWsState] = useState<'idle' | 'live' | 'closed'>('idle')
  const mapRef = useRef<Map<number, HlCandle>>(new Map())

  const bootstrap = useCallback(async () => {
    if (!enabled || !coin) return
    setLoading(true)
    setError(null)
    mapRef.current = new Map()
    try {
      const ms = intervalToMs(interval)
      const end = Date.now()
      const start = end - ms * Math.min(maxBars + 50, 5000)
      const snap = await fetchCandleSnapshot({ coin, interval, startTime: start, endTime: end })
      for (const c of snap) mapRef.current.set(c.t, c)
      setCandles(mergeSorted(mapRef.current).slice(-maxBars))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setCandles([])
    } finally {
      setLoading(false)
    }
  }, [coin, interval, maxBars, enabled])

  useEffect(() => {
    if (!enabled || !coin) {
      mapRef.current = new Map()
      setCandles([])
      setWsState('idle')
      setLoading(false)
      setError(null)
      return
    }
    void bootstrap()
  }, [bootstrap, enabled, coin])

  useEffect(() => {
    if (!enabled || !coin) return
    setWsState('idle')
    const unsub = subscribeHlCandles(
      coin,
      interval,
      (c) => {
        mapRef.current.set(c.t, c)
        setCandles(mergeSorted(mapRef.current).slice(-maxBars))
      },
      (s) => {
        if (s === 'open') setWsState('live')
        if (s === 'close') setWsState('closed')
      }
    )
    return unsub
  }, [coin, interval, maxBars, enabled])

  const ohlc = useMemo(() => {
    if (!enabled || candles.length === 0) return EMPTY_OHLC
    const opens = candles.map((x) => x.o)
    const highs = candles.map((x) => x.h)
    const lows = candles.map((x) => x.l)
    const closes = candles.map((x) => x.c)
    const vols = candles.map((x) => x.v)
    return { opens, highs, lows, closes, vols, last: candles[candles.length - 1] }
  }, [candles, enabled])

  return {
    candles,
    ohlc,
    loading,
    error,
    wsState,
    reload: bootstrap,
  }
}
