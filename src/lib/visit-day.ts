const HONG_KONG_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Hong_Kong",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export function visitDay(now: Date): string {
  return HONG_KONG_DAY.format(now)
}

export function isNewVisit(seenDay: string | undefined, day: string): boolean {
  return seenDay !== day
}
