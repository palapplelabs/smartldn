"use client"

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react"
import { DEFAULT_LOCALE, ensureSimplified, MESSAGES, type Locale, type Messages } from "@/lib/i18n"
import { noteServerLocale, preferenceServerSnapshot, preferenceSnapshot, storedPreferenceRaw, subscribePreferences, updatePreference } from "@/lib/preferences"

type LocaleContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  messages: Messages
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ initial, children }: { initial: Locale; children: ReactNode }) {
  noteServerLocale(initial || DEFAULT_LOCALE)
  const locale = useSyncExternalStore(subscribePreferences, preferenceSnapshot, preferenceServerSnapshot).locale
  const [simplifiedReady, setSimplifiedReady] = useState(false)
  const messages = MESSAGES[locale]
  const setLocale = (next: Locale) => {
    writeLocale(next)
    updatePreference({ locale: next })
  }
  useEffect(() => {
    const saved = preferenceSnapshot().locale
    if (saved !== initial) writeLocale(saved)
    if (!storedPreferenceRaw()) updatePreference({ locale: initial || DEFAULT_LOCALE })
  }, [initial])
  useEffect(() => {
    if (locale !== "zh-CN") return
    let cancel = false
    void ensureSimplified().then(() => {
      if (!cancel) setSimplifiedReady(true)
    })
    return () => {
      cancel = true
    }
  }, [locale])
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dataset.locale = locale
    document.title = messages.documentTitle
  }, [locale, messages.documentTitle, simplifiedReady])
  return <LocaleContext.Provider value={{ locale, setLocale, messages }}>{children}</LocaleContext.Provider>
}

function writeLocale(next: Locale) {
  document.cookie = `locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`
}

export function useI18n(): LocaleContextValue {
  const value = useContext(LocaleContext)
  if (!value) {
    return { locale: DEFAULT_LOCALE, setLocale: () => undefined, messages: MESSAGES[DEFAULT_LOCALE] }
  }
  return value
}

