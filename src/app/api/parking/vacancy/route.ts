import { loadParkingVacancy } from "@/lib/parking"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? ""
  if (!id) return Response.json({ ok: false, error: "Car park missing" }, { status: 400 })
  const vacancy = await loadParkingVacancy(id)
  if (!vacancy.ok) return Response.json({ ok: false, error: "Parking vacancy failed" }, { status: 502 })
  return Response.json(vacancy)
}
