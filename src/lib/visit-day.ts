const LONDON_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export function visitDay(now: Date): string {
  return LONDON_DAY.format(now)
}
