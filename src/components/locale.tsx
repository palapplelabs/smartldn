import { MESSAGES, type Messages } from "@/lib/i18n"

// The site is English only. The hook keeps every component reading its copy
// from the one table in lib/i18n.
export function useI18n(): { messages: Messages } {
  return { messages: MESSAGES }
}
