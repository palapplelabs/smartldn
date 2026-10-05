import { visitDay } from "@/lib/visit-day"
import { readVisitDays } from "@/lib/visits"

export const dynamic = "force-dynamic"

export async function GET() {
  const day = visitDay(new Date())
  const stored = await readVisitDays()
  if (!stored) return Response.json({ ok: false, day, people: 0, opens: 0, days: [] })
  const days = stored.some((item) => item.day === day) ? stored : [...stored, { day, people: 0, opens: 0 }]
  const today = days.find((item) => item.day === day) ?? { day, people: 0, opens: 0 }
  return Response.json({ ok: true, day, people: today.people, opens: today.opens, days })
}
