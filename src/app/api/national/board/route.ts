import { MissingKey, departureBoard } from "@/lib/national-rail-feed"
import { errorText } from "@/lib/snapshot-route"
import type { NationalBoardResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

// The live departure board of one London National Rail station, by CRS code.
export async function GET(request: Request) {
  const crs = new URL(request.url).searchParams.get("crs")?.trim().toUpperCase() ?? ""
  try {
    const board = await departureBoard(crs)
    if (!board) return Response.json({ ok: false, error: "Station not found", board: null } satisfies NationalBoardResponse, { status: 404 })
    return Response.json({ ok: true, board } satisfies NationalBoardResponse)
  } catch (error) {
    const status = error instanceof MissingKey ? 503 : 502
    return Response.json({ ok: false, error: errorText(error, "Departures failed"), board: null } satisfies NationalBoardResponse, { status })
  }
}
