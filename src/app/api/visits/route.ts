import { visitDay } from "@/lib/visit-day"
import { readVisitDays } from "@/lib/visits"

export const dynamic = "force-dynamic"

export async function GET() {
  const day = visitDay(new Date())
  const stored = await readVisitDays()
  if (!stored) return Response.json({ ok: false, day, opens: 0, days: [] })
  const today = stored.find((item) => item.day === day)
  return Response.json({ ok: true, day, opens: today?.opens ?? 0, days: stored })
}
