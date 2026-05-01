import type { Locale } from '../i18n/locale'

export interface FearGreedSnapshot {
  value: number
  /** Raw EN label from Alternative.me API. */
  classificationEn: string
  /** API update time (ms). */
  updatedAtMs: number
}

/** Dev: Vite proxy `/alternative-me-fng` -> `https://api.alternative.me/fng` */
export function fearGreedApiUrl(): string {
  return import.meta.env.DEV ? '/alternative-me-fng/?limit=1' : 'https://api.alternative.me/fng/?limit=1'
}

export async function fetchFearGreedSnapshot(): Promise<FearGreedSnapshot | null> {
  const res = await fetch(fearGreedApiUrl(), { method: 'GET' })
  if (!res.ok) throw new Error(`Fear & Greed HTTP ${res.status}`)
  const json = (await res.json()) as {
    data?: { value?: string; value_classification?: string; timestamp?: string }[]
  }
  const row = json?.data?.[0]
  if (!row) return null
  const value = parseInt(String(row.value ?? ''), 10)
  if (!Number.isFinite(value)) return null
  const tsSec = parseInt(String(row.timestamp ?? '0'), 10)
  return {
    value: Math.min(100, Math.max(0, value)),
    classificationEn: String(row.value_classification ?? 'Neutral').trim(),
    updatedAtMs: Number.isFinite(tsSec) ? tsSec * 1000 : Date.now(),
  }
}

/** Discrete zone 0-4 for strip border color. */
export function fearGreedZone(value: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 24) return 0
  if (value <= 44) return 1
  if (value <= 55) return 2
  if (value <= 74) return 3
  return 4
}

const CLASS_FR: Record<string, string> = {
  'Extreme Fear': 'Peur extr\u00eame',
  Fear: 'Peur',
  Neutral: 'Neutre',
  Greed: 'Cupidit\u00e9',
  'Extreme Greed': 'Cupidit\u00e9 extr\u00eame',
}

export function fearGreedClassificationLabel(classificationEn: string, locale: Locale): string {
  if (locale === 'fr') {
    const fr = CLASS_FR[classificationEn]
    if (fr) return fr
  }
  return classificationEn
}
