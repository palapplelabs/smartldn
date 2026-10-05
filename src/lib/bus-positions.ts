import type { BusVehicle } from "./types.ts"

// DfT Bus Open Data Service, SIRI-VM. TfL buses report as operator TFLO; coaches
// and buses from outside London share the same feed. Each record names the route
// the way riders know it, which the smaller GTFS-RT feed does not.

// A bus that has not reported for five minutes has usually finished its run.
const STALE_MS = 5 * 60_000

export function parseSiriVm(xml: string, now: number): BusVehicle[] {
  const vehicles: BusVehicle[] = []
  const seen = new Set<string>()
  for (const match of xml.matchAll(/<VehicleActivity>([\s\S]*?)<\/VehicleActivity>/g)) {
    const record = match[1] ?? ""
    const at = Date.parse(tag(record, "RecordedAtTime"))
    if (!Number.isFinite(at) || now - at > STALE_MS) continue
    const lng = Number(tag(record, "Longitude"))
    const lat = Number(tag(record, "Latitude"))
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) continue
    const operator = tag(record, "OperatorRef")
    const vehicle = tag(record, "VehicleRef")
    const id = `${operator}:${vehicle || tag(record, "ItemIdentifier")}`
    if (seen.has(id)) continue
    seen.add(id)
    const bearing = Number(tag(record, "Bearing"))
    vehicles.push({
      id,
      route: tag(record, "PublishedLineName") || tag(record, "LineRef"),
      dest: place(tag(record, "DestinationName")),
      operator,
      lng: round(lng),
      lat: round(lat),
      bearing: tag(record, "Bearing") && Number.isFinite(bearing) ? Math.round(bearing) : null,
      at,
    })
  }
  return vehicles
}

export function vehiclesWithin(vehicles: readonly BusVehicle[], box: [number, number, number, number], cap: number): BusVehicle[] {
  const [west, south, east, north] = box
  const inside: BusVehicle[] = []
  for (const vehicle of vehicles) {
    if (vehicle.lng < west || vehicle.lng > east || vehicle.lat < south || vehicle.lat > north) continue
    inside.push(vehicle)
    if (inside.length >= cap) break
  }
  return inside
}

// "Waterfront_Bus_Station" → "Waterfront Bus Station"
function place(value: string): string {
  return decode(value).replace(/_/g, " ").replace(/\s+/g, " ").trim()
}

function tag(xml: string, name: string): string {
  const start = xml.indexOf(`<${name}>`)
  if (start < 0) return ""
  const from = start + name.length + 2
  const end = xml.indexOf(`</${name}>`, from)
  return end < 0 ? "" : xml.slice(from, end).trim()
}

function decode(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
}

function round(value: number): number {
  return Math.round(value * 1e5) / 1e5
}
