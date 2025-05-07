import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations, Locale, TranslationKeys } from '@/lib/i18n/translations'

type LocaleContextType = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const LocaleContext = createContext<LocaleContextType | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem('locale') as Locale
    return saved || 'en'
  })

  useEffect(() => {
    localStorage.setItem('locale', locale)
  }, [locale])

  const t = (path: string) => {
    return path.split('.').reduce((obj: any, key: string) => {
      return obj?.[key]
    }, translations[locale]) || path
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider')
  }
  return context
}
