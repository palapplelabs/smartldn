// Page opens per London day. There is no per-person count: that would need a
// cookie or an identifier, and the site keeps neither.
export type DayVisits = {
  day: string
  opens: number
}

const KEPT_DAYS = 14

export function addVisit(days: readonly DayVisits[], day: string): DayVisits[] {
  const current = days.find((item) => item.day === day)
  const next = [...days.filter((item) => item.day !== day), { day, opens: (current?.opens ?? 0) + 1 }]
  next.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
  return next.slice(-KEPT_DAYS)
}

export function parseVisitDays(raw: string | null): DayVisits[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return []
      const day = "day" in item && typeof item.day === "string" ? item.day : ""
      const opens = "opens" in item && typeof item.opens === "number" ? item.opens : 0
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return []
      return [{ day, opens }]
    })
  } catch {
    return []
  }
}
