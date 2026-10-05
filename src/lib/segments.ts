import centerlinesJson from "../../data/strategic-centerlines.json"
import { bandForSaturation, bandForSpeed } from "@/lib/speed"
import type { Corridor, SpeedSummary } from "@/lib/types"

export type Centerline = {
  id: string
  roadEn: string
  roadTc: string
  direction: string
  coordinates: [number, number][]
}

// The road network file stores Hong Kong 1980 latitude and longitude. Plotted as
// WGS84, every road sits upper-left of the map. Lands Department constants for
// the territory: WGS84 longitude = HK80 longitude + 8.8″, WGS84 latitude = HK80 latitude − 5.5″.
const HK80_TO_WGS84_LNG = 8.8 / 3600
const HK80_TO_WGS84_LAT = -5.5 / 3600

let geometry: Promise<Centerline[]> | null = null

export function loadCenterlines(): Promise<Centerline[]> {
  geometry ??= Promise.resolve(seatOnWgs84(centerlinesJson as Centerline[]))
  return geometry
}

function seatOnWgs84(lines: Centerline[]): Centerline[] {
  return lines.map((line) => ({
    ...line,
    coordinates: line.coordinates.map(([lng, lat]) => [lng + HK80_TO_WGS84_LNG, lat + HK80_TO_WGS84_LAT]),
  }))
}

export function corridorsFromSegments(
  lines: Centerline[],
  speeds: Map<string, number | null>,
  saturation: Map<string, string> = new Map(),
): Corridor[] {
  return lines.map((line) => {
    const speedKmh = speeds.get(line.id) ?? null
    // Names come from the centreline street, then its alias or route number.
    // 策略性道路 is only a piece the Transport Department left unnamed.
    const roadEn = line.roadEn.trim()
    const roadTc = line.roadTc.trim()
    return {
      id: line.id,
      roadTc: roadTc || roadEn || "策略性道路",
      roadEn: roadEn || (roadTc ? "" : "Strategic road"),
      direction: "",
      speedKmh,
      band: bandForSaturation(saturation.get(line.id)) ?? bandForSpeed(speedKmh),
      lengthKm: lengthKm(line.coordinates),
      detectorCount: 0,
      coordinates: line.coordinates,
    }
  })
}

export type LamppostSite = {
  id: string
  roadTc: string
  roadEn: string
  lat: number
  lng: number
  direction: string
}

export function lamppostCorridors(sites: LamppostSite[], speeds: Map<string, number | null>): Corridor[] {
  return sites.flatMap((site) => {
    if (!Number.isFinite(site.lat) || !Number.isFinite(site.lng)) return []
    const speedKmh = speeds.get(site.id) ?? null
    return [
      {
        id: site.id,
        roadTc: site.roadTc,
        roadEn: site.roadEn,
        direction: site.direction,
        speedKmh,
        band: bandForSpeed(speedKmh),
        lengthKm: 0,
        detectorCount: 1,
        coordinates: [[site.lng, site.lat]],
      },
    ]
  })
}

export function summarizeCorridors(corridors: Corridor[], detectorCount: number): SpeedSummary {
  const summary: SpeedSummary = {
    corridorCount: corridors.length,
    detectorCount,
    meanSpeedKmh: null,
    free: 0,
    slow: 0,
    congested: 0,
    unknown: 0,
  }
  let weighted = 0
  let weight = 0
  for (const corridor of corridors) {
    summary[corridor.band] += 1
    if (corridor.speedKmh == null || corridor.lengthKm <= 0) continue
    weighted += corridor.speedKmh * corridor.lengthKm
    weight += corridor.lengthKm
  }
  summary.meanSpeedKmh = weight > 0 ? weighted / weight : null
  return summary
}

function lengthKm(coordinates: [number, number][]): number {
  let total = 0
  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1]
    const point = coordinates[index]
    if (!previous || !point) continue
    total += haversineKm(previous, point)
  }
  return total
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const earthKm = 6371
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLng = ((b[0] - a[0]) * Math.PI) / 180
  const lat1 = (a[1] * Math.PI) / 180
  const lat2 = (b[1] * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(h)))
}
