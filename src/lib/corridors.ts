import { bandForSpeed } from "@/lib/speed"
import type { Corridor, SpeedBand, SpeedSummary } from "@/lib/types"

export type DetectorSite = {
  id: string
  roadTc: string
  roadEn: string
  lat: number
  lng: number
  direction: string
}

const MAX_GAP_KM = 2.4

type Bound = "east" | "west" | "north" | "south" | "as-sorted"

type SiteWithSpeed = DetectorSite & { speedKmh: number | null }

export function roadStem(roadTc: string): string {
  let name = roadTc.trim()
  name = name.replace(/\s*[-–—]\s*[東南西北]行.*$/, "")
  name = name.replace(/\s*[（(].*$/, "")
  const near = name.indexOf("近")
  if (near > 0) name = name.slice(0, near)
  return name.trim()
}

export function publishedDirection(roadTc: string, direction: string): string {
  const match = roadTc.match(/[東南西北]行/)
  if (match) return match[0]
  return direction.trim()
}

function travelBound(direction: string): Bound {
  if (direction.startsWith("東")) return "east"
  if (direction.startsWith("西")) return "west"
  if (direction.startsWith("南")) return "south"
  if (direction.startsWith("北")) return "north"
  const english = direction.toLowerCase()
  if (english.includes("east")) return "east"
  if (english.includes("west")) return "west"
  if (english.includes("south")) return "south"
  if (english.includes("north")) return "north"
  return "as-sorted"
}

function haversineKm(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const earthKm = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(h)))
}

function prefersForward(bound: Bound, dLng: number, dLat: number): boolean {
  switch (bound) {
    case "east":
      return dLng >= 0
    case "west":
      return dLng <= 0
    case "north":
      return dLat >= 0
    case "south":
      return dLat <= 0
    case "as-sorted":
      return true
    default: {
      const exhaustive: never = bound
      return exhaustive
    }
  }
}

function sortAlong(points: SiteWithSpeed[], bound: Bound): SiteWithSpeed[] {
  if (points.length < 2) return points
  let meanLng = 0
  let meanLat = 0
  for (const point of points) {
    meanLng += point.lng
    meanLat += point.lat
  }
  meanLng /= points.length
  meanLat /= points.length

  let xx = 0
  let xy = 0
  let yy = 0
  for (const point of points) {
    const dx = point.lng - meanLng
    const dy = point.lat - meanLat
    xx += dx * dx
    xy += dx * dy
    yy += dy * dy
  }

  const trace = xx + yy
  const det = xx * yy - xy * xy
  const lambda = trace / 2 + Math.sqrt(Math.max(0, (trace * trace) / 4 - det))
  let vx = xy
  let vy = lambda - xx
  if (Math.abs(vx) + Math.abs(vy) < 1e-12) {
    vx = 1
    vy = 0
  }
  const length = Math.hypot(vx, vy) || 1
  vx /= length
  vy /= length

  const sorted = [...points].sort((a, b) => {
    const pa = (a.lng - meanLng) * vx + (a.lat - meanLat) * vy
    const pb = (b.lng - meanLng) * vx + (b.lat - meanLat) * vy
    return pa - pb
  })
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (!first || !last) return sorted
  const forward = prefersForward(bound, last.lng - first.lng, last.lat - first.lat)
  return forward ? sorted : sorted.reverse()
}

function splitChains(points: SiteWithSpeed[]): SiteWithSpeed[][] {
  const chains: SiteWithSpeed[][] = []
  let current: SiteWithSpeed[] = []
  for (const point of points) {
    const previous = current[current.length - 1]
    if (previous && haversineKm(previous, point) > MAX_GAP_KM) {
      chains.push(current)
      current = [point]
    } else {
      current.push(point)
    }
  }
  if (current.length > 0) chains.push(current)
  return chains
}

function chainLength(points: SiteWithSpeed[]): number {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const point = points[index]
    if (previous && point) total += haversineKm(previous, point)
  }
  return total
}

function meanSpeed(points: SiteWithSpeed[]): number | null {
  const speeds = points.flatMap((point) =>
    point.speedKmh == null ? [] : [point.speedKmh],
  )
  if (speeds.length === 0) return null
  return speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length
}

function emptySummary(): SpeedSummary {
  return {
    corridorCount: 0,
    detectorCount: 0,
    meanSpeedKmh: null,
    free: 0,
    slow: 0,
    congested: 0,
    unknown: 0,
  }
}

function countBand(summary: SpeedSummary, band: SpeedBand) {
  switch (band) {
    case "free":
      summary.free += 1
      break
    case "slow":
      summary.slow += 1
      break
    case "congested":
      summary.congested += 1
      break
    case "unknown":
      summary.unknown += 1
      break
    default: {
      const exhaustive: never = band
      return exhaustive
    }
  }
}

export function buildCorridors(
  sites: DetectorSite[],
  speeds: Map<string, number | null>,
): { corridors: Corridor[]; summary: SpeedSummary } {
  const grouped = new Map<string, SiteWithSpeed[]>()
  for (const site of sites) {
    if (!Number.isFinite(site.lat) || !Number.isFinite(site.lng)) continue
    if (site.lat < 22 || site.lat > 22.7 || site.lng < 113.7 || site.lng > 114.5) continue
    const roadTc = roadStem(site.roadTc) || site.roadTc.trim()
    const direction = publishedDirection(site.roadTc, site.direction)
    const key = `${roadTc}::${direction}`
    const list = grouped.get(key) ?? []
    list.push({
      ...site,
      roadTc,
      direction,
      speedKmh: speeds.get(site.id) ?? null,
    })
    grouped.set(key, list)
  }

  const corridors: Corridor[] = []
  for (const [key, sitesInGroup] of grouped) {
    const direction = sitesInGroup[0]?.direction ?? ""
    const ordered = sortAlong(sitesInGroup, travelBound(direction))
    const chains = splitChains(ordered)
    chains.forEach((chain, index) => {
      const first = chain[0]
      if (!first) return
      const speedKmh = meanSpeed(chain)
      const band = bandForSpeed(speedKmh)
      corridors.push({
        id: `${key}:${index}`,
        roadTc: first.roadTc,
        roadEn: first.roadEn.split(" near ")[0]?.trim() || first.roadEn,
        direction,
        speedKmh,
        band,
        lengthKm: chainLength(chain),
        detectorCount: chain.length,
        coordinates: chain.map((point) => [point.lng, point.lat]),
      })
    })
  }

  corridors.sort((a, b) => a.roadTc.localeCompare(b.roadTc, "zh-Hant"))

  const summary = emptySummary()
  summary.corridorCount = corridors.length
  summary.detectorCount = sites.length
  let weighted = 0
  let weight = 0
  for (const corridor of corridors) {
    countBand(summary, corridor.band)
    if (corridor.speedKmh == null) continue
    const corridorWeight = Math.max(corridor.lengthKm, 0.05)
    weighted += corridor.speedKmh * corridorWeight
    weight += corridorWeight
  }
  summary.meanSpeedKmh = weight > 0 ? weighted / weight : null
  return { corridors, summary }
}

export function laneSpeed(lanes: { speed: number; volume: number; valid: boolean }[]): number | null {
  let weighted = 0
  let weight = 0
  for (const lane of lanes) {
    if (!lane.valid || !Number.isFinite(lane.speed)) continue
    const laneWeight = lane.volume > 0 ? lane.volume : 1
    weighted += lane.speed * laneWeight
    weight += laneWeight
  }
  return weight > 0 ? weighted / weight : null
}
