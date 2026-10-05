import { cachedValue } from "@/lib/board-cache"
import { inLondon, stopReachMetres } from "@/lib/view-reach"
import { pointsWithin } from "@/lib/nearest"
import { num, records, text, tflJson } from "@/lib/tfl"
import type { BusCall, BusPlacesResponse, BusStopBoard } from "@/lib/types"

const PLACES_MS = 12 * 60 * 60 * 1000
const BOARD_MS = 30_000
const MAX_RADIUS_M = 1_500
const STOP_CAP = 60

// Stops come from TfL's own search around the map centre, so a new stop or a
// moved stand is on the map the next day without a rebuild.
export async function loadBusPlaces(lng: number, lat: number, zoom: number): Promise<BusPlacesResponse> {
  if (!inLondon(lng, lat)) return { ok: true, stops: [] }
  const radius = Math.round(Math.min(MAX_RADIUS_M, stopReachMetres(zoom, lat)))
  const body = await tflJson("/StopPoint", PLACES_MS, {
    lat: lat.toFixed(4),
    lon: lng.toFixed(4),
    stopTypes: "NaptanPublicBusCoachTram",
    modes: "bus",
    radius: String(radius),
    returnLines: "true",
  })
  const rows = typeof body === "object" && body !== null && "stopPoints" in body ? records(body.stopPoints) : []
  const stops = rows.flatMap((row) => {
    const id = text(row, "naptanId")
    const stopLng = num(row, "lon")
    const stopLat = num(row, "lat")
    if (!id || stopLng == null || stopLat == null) return []
    const routes = records(row.lines).map((line) => text(line, "name")).filter(Boolean)
    if (routes.length === 0) return []
    return [{ id, name: text(row, "commonName"), indicator: stopIndicator(text(row, "indicator")), lng: stopLng, lat: stopLat, routes: sortRoutes(routes) }]
  })
  return { ok: true, stops: pointsWithin(stops, lng, lat, radius, STOP_CAP) }
}

export function loadBusBoard(id: string): Promise<{ ok: true; stop: BusStopBoard } | { ok: false }> {
  return cachedValue(`bus:${id}`, BOARD_MS, async () => {
    try {
      const rows = records(await tflJson(`/StopPoint/${encodeURIComponent(id)}/Arrivals`, BOARD_MS))
      const calls = busCalls(rows)
      const first = rows[0]
      return {
        ok: true as const,
        stop: {
          id,
          name: text(first, "stationName"),
          indicator: stopIndicator(text(first, "platformName")),
          lng: 0,
          lat: 0,
          routes: sortRoutes([...new Set(calls.map((call) => call.route))]),
          calls,
          clock: "ready" as const,
        },
      }
    } catch {
      return { ok: false as const }
    }
  })
}

export function busCalls(rows: Record<string, unknown>[]): BusCall[] {
  return rows
    .flatMap((row) => {
      const route = text(row, "lineName")
      const seconds = num(row, "timeToStation")
      if (!route || seconds == null) return []
      return [{ route, dest: text(row, "destinationName"), eta: text(row, "expectedArrival"), minutes: Math.max(0, Math.floor(seconds / 60)), vehicle: text(row, "vehicleId") }]
    })
    .sort((a, b) => (a.minutes ?? 0) - (b.minutes ?? 0) || a.route.localeCompare(b.route, "en", { numeric: true }))
}

// "Stop X" → "X"; "->W" or "null" carry nothing a reader needs.
export function stopIndicator(value: string): string {
  const trimmed = value.replace(/^Stop\s+/i, "").trim()
  if (!trimmed || trimmed === "null" || trimmed.startsWith("->")) return ""
  return trimmed
}

export function sortRoutes(routes: string[]): string[] {
  return [...new Set(routes)].sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
}
