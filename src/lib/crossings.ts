import { roadOf } from "@/lib/camera-place"
import type { ApproachPoint, HarbourJourney } from "@/lib/types"

const CODES = ["CH", "EH", "WH"] as const

export type CrossingCode = (typeof CODES)[number]

const LABEL: Record<CrossingCode, string> = {
  CH: "Cross Harbour",
  EH: "Eastern",
  WH: "Western",
}

export type CrossingBest = {
  code: CrossingCode
  label: string
  minutes: number
  from: string
  fromTc: string
  colour: HarbourJourney["colour"]
  coordinates: [number, number]
  slower: number
}

export function crossingsFrom(point: ApproachPoint | null): CrossingBest[] {
  if (!point) return []
  const rows: CrossingBest[] = []
  for (const code of CODES) {
    const leg = point.legs.find((item) => item.code === code && item.minutes != null)
    if (!leg || leg.minutes == null) continue
    rows.push({
      code,
      label: LABEL[code],
      minutes: leg.minutes,
      from: roadOf(point.name),
      fromTc: point.nameTc ? roadOf(point.nameTc) : "",
      colour: leg.colour,
      coordinates: point.coordinates,
      slower: 0,
    })
  }
  const fastest = rows.reduce((best, row) => Math.min(best, row.minutes), Number.POSITIVE_INFINITY)
  return rows.map((row) => ({ ...row, slower: row.minutes - fastest }))
}

export function nearestApproach(points: ApproachPoint[], centre: { lng: number; lat: number } | null): ApproachPoint | null {
  const usable = points.filter((point) => point.legs.some((leg) => leg.minutes != null && isCrossing(leg.code)))
  if (usable.length === 0) return null
  if (!centre) return usable.reduce((best, point) => (crossingCount(point) > crossingCount(best) ? point : best))
  return usable.reduce((best, point) => (metresBetween(point.coordinates, centre) < metresBetween(best.coordinates, centre) ? point : best))
}

export function warnedCrossings(points: ApproachPoint[]): CrossingBest[] {
  const found = new Map<CrossingCode, CrossingBest>()
  for (const point of points) {
    for (const leg of point.legs) {
      if (leg.minutes == null || !isCrossing(leg.code)) continue
      if (leg.colour !== "red" && leg.colour !== "amber") continue
      const row: CrossingBest = {
        code: leg.code,
        label: LABEL[leg.code],
        minutes: leg.minutes,
        from: roadOf(point.name),
        fromTc: point.nameTc ? roadOf(point.nameTc) : "",
        colour: leg.colour,
        coordinates: point.coordinates,
        slower: 0,
      }
      const current = found.get(leg.code)
      if (current && !worseApproach(row, current)) continue
      found.set(leg.code, row)
    }
  }
  return CODES.flatMap((code) => {
    const row = found.get(code)
    return row ? [row] : []
  })
}

function crossingCount(point: ApproachPoint): number {
  return point.legs.filter((leg) => leg.minutes != null && isCrossing(leg.code)).length
}

function worseApproach(next: CrossingBest, current: CrossingBest): boolean {
  const rank = { red: 2, amber: 1, green: 0, none: 0 }
  if (rank[next.colour] !== rank[current.colour]) return rank[next.colour] > rank[current.colour]
  return next.minutes > current.minutes
}

function metresBetween(from: [number, number], to: { lng: number; lat: number }): number {
  const lat = ((from[1] + to.lat) / 2) * Math.PI / 180
  const east = (from[0] - to.lng) * Math.cos(lat) * 111_320
  const north = (from[1] - to.lat) * 110_540
  return Math.hypot(east, north)
}

function isCrossing(code: string): code is CrossingCode {
  return code === "CH" || code === "EH" || code === "WH"
}
