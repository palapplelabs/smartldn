import { loadCitybusPlaces } from "@/lib/citybus-feed"
import type { CitybusPlacesResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

const empty = (error: string): CitybusPlacesResponse => ({ ok: false, error, stops: [] })

export function GET(request: Request) {
  const url = new URL(request.url)
  const lng = Number(url.searchParams.get("lng"))
  const lat = Number(url.searchParams.get("lat"))
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return Response.json(empty("Citybus centre missing"), { status: 400 })
  }
  try {
    return Response.json(loadCitybusPlaces(lng, lat))
  } catch (error) {
    return Response.json(empty(error instanceof Error ? error.message : "Citybus stops failed"), { status: 502 })
  }
}
