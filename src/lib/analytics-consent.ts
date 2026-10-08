// The visitor's answer to the analytics question, kept in their own browser.
// Nothing is sent and no analytics cookie is set until it is "granted".
export type Consent = "granted" | "denied" | "unset"

const KEY = "smartldn-analytics-consent"
const listeners = new Set<() => void>()
let current: Consent | null = null

export function readConsent(raw: string | null): Consent {
  return raw === "granted" || raw === "denied" ? raw : "unset"
}

export function consentSnapshot(): Consent {
  if (current) return current
  if (typeof window === "undefined") return "unset"
  try {
    current = readConsent(window.localStorage.getItem(KEY))
  } catch {
    current = "unset"
  }
  return current
}

export function consentServerSnapshot(): Consent {
  return "unset"
}

export function subscribeConsent(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setConsent(next: Consent): void {
  current = next
  try {
    if (next === "unset") window.localStorage.removeItem(KEY)
    else window.localStorage.setItem(KEY, next)
  } catch {
    // A private window can refuse the write; the answer still holds for this visit.
  }
  for (const listener of listeners) listener()
}
