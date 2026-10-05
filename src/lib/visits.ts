import { addVisit, parseVisitDays } from "@/lib/visit-counts"
import { visitDay } from "@/lib/visit-day"

type VisitLog = {
  writeDataPoint: (point: { indexes: string[]; blobs: string[]; doubles: number[] }) => void
}

type VisitCounts = {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

type WorkerRuntime = {
  env: { VISITS?: VisitLog; VISIT_COUNTS?: VisitCounts }
  waitUntil: (promise: Promise<unknown>) => void
}

export const VISIT_DAYS_KEY = "days"

// The counter lives in Cloudflare bindings (see cloudflare.config.ts). Under
// `next dev` there is no Worker runtime, so the counter quietly does nothing.
// The specifier is held in a variable so the Next bundler does not try to resolve it.
const RUNTIME_MODULE = "cloudflare:workers"
let runtime: Promise<WorkerRuntime | null> | null = null

function workerRuntime(): Promise<WorkerRuntime | null> {
  runtime ??= import(/* webpackIgnore: true */ /* @vite-ignore */ RUNTIME_MODULE).then(
    (module: WorkerRuntime) => module,
    () => null,
  )
  return runtime
}

export function recordPageView(mark: string | null, now = new Date()): void {
  if (mark !== "new" && mark !== "return") return
  const day = visitDay(now)
  void workerRuntime().then((worker) => {
    if (!worker) return
    try {
      worker.env.VISITS?.writeDataPoint({ indexes: [day], blobs: [mark], doubles: [1] })
    } catch {
      // A missed tally must not stop the page.
    }
    const counts = worker.env.VISIT_COUNTS
    if (!counts) return
    const saved = saveVisit(counts, day, mark)
    try {
      worker.waitUntil(saved)
    } catch {
      void saved
    }
  })
}

async function saveVisit(counts: VisitCounts, day: string, mark: "new" | "return"): Promise<void> {
  try {
    const days = addVisit(parseVisitDays(await counts.get(VISIT_DAYS_KEY)), day, mark)
    await counts.put(VISIT_DAYS_KEY, JSON.stringify(days))
  } catch {
    // The page is already on its way.
  }
}

export async function readVisitDays(): Promise<ReturnType<typeof parseVisitDays> | null> {
  const counts = (await workerRuntime())?.env.VISIT_COUNTS
  if (!counts) return null
  return parseVisitDays(await counts.get(VISIT_DAYS_KEY))
}
