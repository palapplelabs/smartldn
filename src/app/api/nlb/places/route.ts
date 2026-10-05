import { loadNlbPlaces } from "@/lib/nlb-feed"
import type { NlbPlacesResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

const empty = (error: string): NlbPlacesResponse => ({ ok: false, error, stops: [] })

export function GET(request: Request) {
  const url = new URL(request.url)
  const lng = Number(url.searchParams.get("lng"))
  const lat = Number(url.searchParams.get("lat"))
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return Response.json(empty("New Lantao Bus centre missing"), { status: 400 })
  }
  try {
    return Response.json(loadNlbPlaces(lng, lat))
  } catch (error) {
    return Response.json(empty(error instanceof Error ? error.message : "New Lantao Bus stops failed"), { status: 502 })
  }
}
