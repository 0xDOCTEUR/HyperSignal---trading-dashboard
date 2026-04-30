export type Locale = 'fr' | 'en'

export const LOCALE_STORAGE_KEY = 'hypersignal-locale'

export function isLocale(x: string): x is Locale {
  return x === 'fr' || x === 'en'
}

export function readStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (raw && isLocale(raw)) return raw
  } catch {
    /* ignore */
  }
  return 'en'
}

export function intlLocaleTag(locale: Locale): string {
  return locale === 'fr' ? 'fr-FR' : 'en-US'
}
