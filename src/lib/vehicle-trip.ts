import type { VehicleStop, VehicleTrip } from "./types.ts"

// A moving bus from the Bus Open Data Service carries its registration, and TfL
// predicts arrivals by the same registration. Together they give the bus's
// next stops; the route sequence for its line adds where those stops are and
// the road the route follows.

export function tripFromArrivals(rows: Record<string, unknown>[]): Omit<VehicleTrip, "route"> | null {
  const calls = rows
    .flatMap((row) => {
      const id = str(row, "naptanId")
      const seconds = typeof row.timeToStation === "number" ? row.timeToStation : NaN
      if (!id || !Number.isFinite(seconds)) return []
      return [{ row, id, seconds }]
    })
    .sort((a, b) => a.seconds - b.seconds)
  const first = calls[0]?.row
  if (!first) return null
  const seen = new Set<string>()
  const stops: VehicleStop[] = []
  for (const call of calls) {
    if (seen.has(call.id)) continue
    seen.add(call.id)
    stops.push({
      id: call.id,
      name: str(call.row, "stationName"),
      indicator: str(call.row, "platformName").replace(/^null$/, ""),
      minutes: Math.max(0, Math.floor(call.seconds / 60)),
      lng: null,
      lat: null,
    })
  }
  return {
    line: str(first, "lineId"),
    lineName: str(first, "lineName"),
    direction: str(first, "direction") === "inbound" ? "inbound" : "outbound",
    dest: str(first, "destinationName"),
    stops,
  }
}

// Coordinates for the upcoming stops, and the route line as TfL draws it.
export function placeTrip(trip: Omit<VehicleTrip, "route">, sequence: unknown): VehicleTrip {
  const points = new Map<string, [number, number]>()
  const root = typeof sequence === "object" && sequence !== null ? (sequence as Record<string, unknown>) : {}
  for (const branch of Array.isArray(root.stopPointSequences) ? root.stopPointSequences : []) {
    const stops = typeof branch === "object" && branch !== null ? (branch as { stopPoint?: unknown }).stopPoint : null
    for (const stop of Array.isArray(stops) ? stops : []) {
      if (typeof stop !== "object" || stop === null) continue
      const { id, lon, lat } = stop as { id?: unknown; lon?: unknown; lat?: unknown }
      if (typeof id === "string" && typeof lon === "number" && typeof lat === "number") points.set(id, [lon, lat])
    }
  }
  const route: [number, number][][] = []
  for (const raw of Array.isArray(root.lineStrings) ? root.lineStrings : []) {
    if (typeof raw !== "string") continue
    try {
      const parsed: unknown = JSON.parse(raw)
      for (const part of Array.isArray(parsed) ? parsed : []) {
        if (!Array.isArray(part)) continue
        const path = part.filter((point): point is [number, number] => Array.isArray(point) && typeof point[0] === "number" && typeof point[1] === "number")
        if (path.length >= 2) route.push(path.map(([lng, lat]) => [round(lng), round(lat)]))
      }
    } catch {
      // A malformed line string only costs the highlight, not the stop list.
    }
  }
  return {
    ...trip,
    stops: trip.stops.map((stop) => {
      const point = points.get(stop.id)
      return point ? { ...stop, lng: point[0], lat: point[1] } : stop
    }),
    route,
  }
}

export function tripCollection(trip: VehicleTrip, stopCap: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = route(trip)
  trip.stops.slice(0, stopCap).forEach((stop, index) => {
    if (stop.lng == null || stop.lat == null) return
    features.push({ type: "Feature", properties: { kind: "stop", order: index }, geometry: { type: "Point", coordinates: [stop.lng, stop.lat] } })
  })
  return { type: "FeatureCollection", features }
}

function route(trip: VehicleTrip): GeoJSON.Feature[] {
  if (trip.route.length === 0) return []
  return [{ type: "Feature", properties: { kind: "route" }, geometry: { type: "MultiLineString", coordinates: trip.route } }]
}

function str(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  return typeof value === "string" ? value.trim() : ""
}

function round(value: number): number {
  return Math.round(value * 1e5) / 1e5
}
