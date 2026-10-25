import type { SearchPlace } from "./types.ts"

// One search box for London: stations from the app's own network, postcodes from
// postcodes.io, and everything else (places, streets, addresses) from Photon on
// OpenStreetMap. Each source is turned into the same shape here, then merged.

export type StationEntry = { code: string; name: string; lng: number; lat: number; lines: string[] }

const FULL_POSTCODE = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i
const OUTCODE = /^[A-Z]{1,2}[0-9][A-Z0-9]?$/i
const STATION_LIMIT = 3
// Two results closer than this, under the same name, are one place (OSM often
// maps each entrance of a station as its own node).
const SAME_PLACE_M = 250

export function cleanQuery(raw: string | null): string | null {
  const text = (raw ?? "").replace(/\s+/g, " ").trim()
  if (text.length < 2 || text.length > 80) return null
  return text
}

export function postcodeKind(query: string): "full" | "outcode" | null {
  if (FULL_POSTCODE.test(query)) return "full"
  if (OUTCODE.test(query)) return "outcode"
  return null
}

export function stationMatches(query: string, stations: readonly StationEntry[]): SearchPlace[] {
  const wanted = fold(query)
  if (!wanted) return []
  const ranked: { rank: number; place: SearchPlace }[] = []
  const seen = new Set<string>()
  for (const station of stations) {
    const name = fold(station.name)
    const rank = name === wanted ? 0 : name.startsWith(wanted) ? 1 : wordStart(name, wanted) ? 2 : -1
    if (rank < 0 || seen.has(name)) continue
    seen.add(name)
    ranked.push({
      rank,
      place: {
        id: `station-${station.code}`,
        name: station.name,
        detail: station.lines.join(" · "),
        kind: "station",
        lng: station.lng,
        lat: station.lat,
        zoom: 15.5,
      },
    })
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || a.place.name.localeCompare(b.place.name))
    .slice(0, STATION_LIMIT)
    .map((row) => row.place)
}

export function postcodePlace(body: unknown): SearchPlace | null {
  const result = field(body, "result")
  const lng = num(result, "longitude")
  const lat = num(result, "latitude")
  if (lng == null || lat == null) return null
  const code = str(result, "postcode") || str(result, "outcode")
  const area = str(result, "admin_district") || firstTwo(field(result, "admin_district"))
  const full = Boolean(str(result, "postcode"))
  return {
    id: `postcode-${code.replace(/\s+/g, "")}`,
    name: code,
    detail: area ? `Postcode · ${area}` : "Postcode",
    kind: "postcode",
    lng,
    lat,
    zoom: full ? 16.5 : 14,
  }
}

export function photonPlaces(body: unknown): SearchPlace[] {
  const features = field(body, "features")
  if (!Array.isArray(features)) return []
  const places: SearchPlace[] = []
  for (const feature of features) {
    const properties = field(feature, "properties")
    const coordinates = field(field(feature, "geometry"), "coordinates")
    if (!Array.isArray(coordinates)) continue
    const [lng, lat] = coordinates
    if (typeof lng !== "number" || typeof lat !== "number") continue
    const street = str(properties, "street")
    const number = str(properties, "housenumber")
    const name = str(properties, "name") || [number, street].filter(Boolean).join(" ")
    if (!name) continue
    const kind = photonKind(str(properties, "type"), str(properties, "osm_key"))
    const area = str(properties, "district") || str(properties, "locality") || str(properties, "city")
    const detail = [kind === "street" ? "" : street, area, str(properties, "postcode")].filter((part) => part && part !== name).join(", ")
    places.push({
      id: `osm-${str(properties, "osm_type")}${num(properties, "osm_id") ?? `${lng},${lat}`}`,
      name,
      detail,
      kind,
      lng,
      lat,
      zoom: KIND_ZOOM[kind],
    })
  }
  return places
}

const KIND_ZOOM: Record<SearchPlace["kind"], number> = {
  station: 15.5,
  postcode: 16.5,
  area: 13.5,
  street: 16,
  place: 16.5,
}

function photonKind(type: string, osmKey: string): SearchPlace["kind"] {
  if (osmKey === "railway" || osmKey === "public_transport") return "station"
  if (type === "street") return "street"
  if (type === "city" || type === "district" || type === "locality" || type === "county" || type === "state") return "area"
  return "place"
}

// Stations first (they are this map's own), then the postcode, then the rest,
// with near-duplicates of the same name dropped.
export function mergePlaces(groups: readonly SearchPlace[][], limit: number): SearchPlace[] {
  const merged: SearchPlace[] = []
  for (const group of groups) {
    for (const place of group) {
      if (merged.length >= limit) return merged
      const twin = merged.some((kept) => fold(kept.name) === fold(place.name) && distanceM(kept, place) < SAME_PLACE_M)
      if (!twin) merged.push(place)
    }
  }
  return merged
}

function wordStart(name: string, wanted: string): boolean {
  return name.split(" ").some((_, index, words) => words.slice(index).join(" ").startsWith(wanted))
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function distanceM(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const x = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180)) * 111_320
  const y = (b.lat - a.lat) * 110_540
  return Math.hypot(x, y)
}

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined
}

function str(value: unknown, key: string): string {
  const found = field(value, key)
  return typeof found === "string" ? found.trim() : ""
}

function num(value: unknown, key: string): number | null {
  const found = field(value, key)
  return typeof found === "number" && Number.isFinite(found) ? found : null
}

// A postcode district can span boroughs; name up to two of them.
function firstTwo(value: unknown): string {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 2).join(", ") : ""
}
