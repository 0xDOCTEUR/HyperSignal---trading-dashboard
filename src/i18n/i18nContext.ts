import { createContext } from 'react'
import type { MessageKey } from './dict'
import type { Locale } from './locale'

export type I18nContextValue = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  nfLocale: string
}

export const I18nContext = createContext<I18nContextValue | null>(null)
