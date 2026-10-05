import { metresPerPixel } from "./nearest.ts"

export type ParkingPark = {
  id: string
  nameTc: string
  nameEn: string
  addressTc: string
  addressEn: string
  lng: number
  lat: number
  heightM: number | null
}

export type ParkingKind = "private" | "lgv" | "hgv" | "motorcycle"

export type ParkingSpace = {
  kind: ParkingKind
  vacancy: number | null
  updated: string
}

const PARK_CAP = 40
const WIDE_RADIUS_M = 80_000

export function soloParkingRadiusMetres(zoom: number, lat: number): number {
  if (!Number.isFinite(zoom)) return WIDE_RADIUS_M
  return Math.min(WIDE_RADIUS_M, Math.max(800, metresPerPixel(zoom, lat) * 1_600))
}

export function parksNear(parks: readonly ParkingPark[], lng: number, lat: number, radiusM: number, cap = PARK_CAP): ParkingPark[] {
  const near = parks.flatMap((park) => {
    const metres = metresBetween(lng, lat, park.lng, park.lat)
    if (metres > radiusM) return []
    return [{ park, metres }]
  })
  near.sort((a, b) => a.metres - b.metres)
  return near.slice(0, cap).map((item) => item.park)
}

export function parseParkingParks(body: unknown): ParkingPark[] {
  if (!body || typeof body !== "object" || !("car_park" in body) || !Array.isArray(body.car_park)) return []
  return body.car_park.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const id = text(row.park_id)
    const lng = number(row.longitude)
    const lat = number(row.latitude)
    if (!id || lng == null || lat == null) return []
    const height = number(row.height)
    return [
      {
        id,
        nameTc: text(row.name_tc),
        nameEn: text(row.name_en),
        addressTc: text(row.displayAddress_tc),
        addressEn: text(row.displayAddress_en),
        lng,
        lat,
        heightM: height != null && height > 0 ? height : null,
      },
    ]
  })
}

export function parseParkingSpaces(body: unknown, id: string): ParkingSpace[] {
  if (!body || typeof body !== "object" || !("car_park" in body) || !Array.isArray(body.car_park)) return []
  const park = body.car_park.find((item) => item && typeof item === "object" && text((item as Record<string, unknown>).park_id) === id)
  if (!park || typeof park !== "object") return []
  const types = (park as Record<string, unknown>).vehicle_type
  if (!Array.isArray(types)) return []
  const spaces: ParkingSpace[] = []
  for (const item of types) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const kind = kindOf(text(row.type))
    if (!kind) continue
    const category = hourlyCategory(row.service_category)
    if (!category) continue
    const published = text(category.vacancy_type) === "A"
    const vacancy = number(category.vacancy)
    spaces.push({
      kind,
      vacancy: published && vacancy != null && vacancy >= 0 ? vacancy : null,
      updated: text(category.lastupdate),
    })
  }
  return spaces
}

function hourlyCategory(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value)) return null
  const rows = value.flatMap((item) => (item && typeof item === "object" ? [item as Record<string, unknown>] : []))
  return rows.find((row) => text(row.category) === "HOURLY") ?? rows[0] ?? null
}

function kindOf(type: string): ParkingKind | null {
  switch (type) {
    case "P":
      return "private"
    case "L":
      return "lgv"
    case "H":
      return "hgv"
    case "M":
      return "motorcycle"
    default:
      return null
  }
}

function metresBetween(lng: number, lat: number, parkLng: number, parkLat: number): number {
  const radius = 6_371_000
  const fromLat = (lat * Math.PI) / 180
  const toLat = (parkLat * Math.PI) / 180
  const dLat = ((parkLat - lat) * Math.PI) / 180
  const dLng = ((parkLng - lng) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2
  return 2 * radius * Math.asin(Math.sqrt(a))
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}
