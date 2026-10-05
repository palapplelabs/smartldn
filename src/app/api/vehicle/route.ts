import { errorText } from "@/lib/snapshot-route"
import { records, tflJson } from "@/lib/tfl"
import { placeTrip, tripFromArrivals } from "@/lib/vehicle-trip"
import type { VehicleTripResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

// UK registrations, as both TfL and the Bus Open Data Service give them.
const REGISTRATION = /^[A-Z0-9]{2,10}$/
const LINE = /^[A-Za-z0-9-]{1,12}$/

// The next stops of one London bus, and its route line for the map highlight.
export async function GET(request: Request) {
  const reg = new URL(request.url).searchParams.get("reg")?.trim().toUpperCase() ?? ""
  if (!REGISTRATION.test(reg)) return Response.json({ ok: false, error: "Bus missing", trip: null } satisfies VehicleTripResponse, { status: 400 })
  try {
    const trip = tripFromArrivals(records(await tflJson(`/Vehicle/${reg}/Arrivals`, 30_000)))
    if (!trip) return Response.json({ ok: true, trip: null } satisfies VehicleTripResponse)
    if (!LINE.test(trip.line)) return Response.json({ ok: true, trip: { ...trip, route: [] } } satisfies VehicleTripResponse)
    // A route's stops and shape change rarely; one read a day per line and direction.
    const sequence = await tflJson(`/Line/${trip.line}/Route/Sequence/${trip.direction}`, 24 * 60 * 60_000).catch(() => null)
    return Response.json({ ok: true, trip: placeTrip(trip, sequence) } satisfies VehicleTripResponse)
  } catch (error) {
    return Response.json({ ok: false, error: errorText(error, "Bus journey failed"), trip: null } satisfies VehicleTripResponse, { status: 502 })
  }
}
