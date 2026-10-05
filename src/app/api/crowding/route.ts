import { errorText } from "@/lib/snapshot-route"
import { tflJson } from "@/lib/tfl"

export const dynamic = "force-dynamic"

const NAPTAN = /^[0-9A-Z]{8,16}$/

// Live busyness against a typical day, for Tube stations that report it.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? ""
  if (!NAPTAN.test(id)) return Response.json({ ok: false, error: "Station missing" }, { status: 400 })
  try {
    const body = await tflJson(`/Crowding/${id}/Live`, 2 * 60_000)
    const row = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {}
    const share = typeof row.percentageOfBaseline === "number" ? row.percentageOfBaseline : null
    return Response.json({ ok: row.dataAvailable === true && share != null, percent: share == null ? null : Math.round(share * 100) })
  } catch (error) {
    return Response.json({ ok: false, error: errorText(error, "Crowding failed") }, { status: 502 })
  }
}
