import { useEffect, useState } from 'react'
import { fetchFearGreedSnapshot, type FearGreedSnapshot } from '../lib/fearGreed'

const REFRESH_MS = 3_600_000

export function useFearGreed() {
  const [snapshot, setSnapshot] = useState<FearGreedSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const snap = await fetchFearGreedSnapshot()
        if (!cancelled) {
          setSnapshot(snap)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const id = window.setInterval(() => {
      void load()
    }, REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return { snapshot, loading, error }
}
