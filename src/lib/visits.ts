import { env, waitUntil } from "cloudflare:workers"
import { addVisit, parseVisitDays } from "@/lib/visit-counts"
import { visitDay } from "@/lib/visit-day"

type VisitLog = {
  writeDataPoint: (point: { indexes: string[]; blobs: string[]; doubles: number[] }) => void
}

type VisitCounts = {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

export const VISIT_DAYS_KEY = "days"

export function recordPageView(mark: string | null, now = new Date()): void {
  if (mark !== "new" && mark !== "return") return
  const day = visitDay(now)
  try {
    visitLog()?.writeDataPoint({
      indexes: [day],
      blobs: [mark],
      doubles: [1],
    })
  } catch {
    // A missed tally must not stop the page.
  }
  const saved = saveVisit(day, mark)
  try {
    waitUntil(saved)
  } catch {
    void saved
  }
}

async function saveVisit(day: string, mark: "new" | "return"): Promise<void> {
  const counts = visitCounts()
  if (!counts) return
  try {
    const days = addVisit(parseVisitDays(await counts.get(VISIT_DAYS_KEY)), day, mark)
    await counts.put(VISIT_DAYS_KEY, JSON.stringify(days))
  } catch {
    // The page is already on its way.
  }
}

function visitLog(): VisitLog | null {
  try {
    const bound = (env as { VISITS?: VisitLog }).VISITS
    if (!bound || typeof bound.writeDataPoint !== "function") return null
    return bound
  } catch {
    return null
  }
}

function visitCounts(): VisitCounts | null {
  try {
    const bound = (env as { VISIT_COUNTS?: VisitCounts }).VISIT_COUNTS
    if (!bound) return null
    return bound
  } catch {
    return null
  }
}

export async function readVisitDays(): Promise<ReturnType<typeof parseVisitDays> | null> {
  const counts = visitCounts()
  if (!counts) return null
  return parseVisitDays(await counts.get(VISIT_DAYS_KEY))
}
