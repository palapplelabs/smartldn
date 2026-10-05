import { loadBusBoard } from "@/lib/bus-feed"
import { errorText } from "@/lib/snapshot-route"

export const dynamic = "force-dynamic"

// TfL stop codes are NaPTAN ATCO codes: digits and capital letters.
const STOP_ID = /^[0-9A-Z]{6,16}$/

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? ""
  if (!STOP_ID.test(id)) return Response.json({ ok: false, error: "Stop missing" }, { status: 400 })
  try {
    const board = await loadBusBoard(id)
    if (!board.ok) return Response.json({ ok: false, error: "Stop board failed" }, { status: 502 })
    return Response.json({ ok: true, stop: board.stop })
  } catch (error) {
    return Response.json({ ok: false, error: errorText(error, "Stop board failed") }, { status: 502 })
  }
}
