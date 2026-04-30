import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { translate, type MessageKey } from './dict'
import { I18nContext } from './i18nContext'
import { intlLocaleTag, LOCALE_STORAGE_KEY, readStoredLocale, type Locale } from './locale'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale())

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, l)
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l === 'en' ? 'en' : 'fr'
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale === 'en' ? 'en' : 'fr'
  }, [locale])

  const nfLocale = useMemo(() => intlLocaleTag(locale), [locale])

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale]
  )

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      nfLocale,
    }),
    [locale, setLocale, t, nfLocale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
