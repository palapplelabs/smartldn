import { MissingKey, londonStations } from "@/lib/national-rail-feed"
import { errorText } from "@/lib/snapshot-route"
import type { NationalStationsResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

// London's National Rail stations, refreshed daily from the Knowledgebase.
export async function GET() {
  try {
    return Response.json({ ok: true, stations: await londonStations() } satisfies NationalStationsResponse, {
      headers: { "Cache-Control": "public, max-age=3600" },
    })
  } catch (error) {
    const status = error instanceof MissingKey ? 503 : 502
    return Response.json({ ok: false, error: errorText(error, "National Rail stations failed"), stations: [] } satisfies NationalStationsResponse, { status })
  }
}
