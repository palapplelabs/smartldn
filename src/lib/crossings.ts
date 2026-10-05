import type { Corridor, CrossingTone, LineStatus, ThamesCrossing } from "./types.ts"

// The road and ferry crossings of the Thames east of Tower Bridge. None of them
// publishes a journey time, so each shows the status TfL publishes for it.
const PLACES = {
  rotherhithe: { name: "Rotherhithe Tunnel", short: "Rotherhithe", coordinates: [-0.0499, 51.5038] as [number, number] },
  blackwall: { name: "Blackwall Tunnel", short: "Blackwall", coordinates: [0.0043, 51.5065] as [number, number] },
  silvertown: { name: "Silvertown Tunnel", short: "Silvertown", coordinates: [0.0117, 51.5022] as [number, number] },
  woolwich: { name: "Woolwich Ferry", short: "Woolwich", coordinates: [0.0626, 51.4945] as [number, number] },
} as const

type DisruptionLike = { properties: GeoJSON.GeoJsonProperties }

export function thamesCrossings(
  corridors: Corridor[],
  disruptions: readonly DisruptionLike[],
  lines: LineStatus[],
): ThamesCrossing[] {
  const blackwall = corridors.find((corridor) => corridor.id === "blackwall tunnel")
  const silvertown = corridors.find((corridor) => corridor.id === "silvertown tunnel")
  const ferry = lines.find((line) => line.id === "woolwich-ferry")
  return [
    fromNotices("rotherhithe", disruptions, /rotherhithe tunnel/i),
    fromCorridor("blackwall", blackwall, disruptions, /blackwall tunnel/i),
    fromCorridor("silvertown", silvertown, disruptions, /silvertown tunnel/i),
    {
      id: "woolwich",
      ...PLACES.woolwich,
      status: ferry ? ferry.status : "No reading",
      detail: ferry?.reason ?? "",
      tone: ferry ? ferry.tone : "none",
    },
  ]
}

function fromCorridor(id: "blackwall" | "silvertown", corridor: Corridor | undefined, disruptions: readonly DisruptionLike[], pattern: RegExp): ThamesCrossing {
  const notice = worstNotice(disruptions, pattern)
  if (!corridor) return fromNotices(id, disruptions, pattern)
  const tone: CrossingTone = corridor.closed || corridor.band === "congested" ? "red" : corridor.band === "slow" ? "amber" : corridor.band === "free" ? "green" : "none"
  const status = corridor.closed ? "Closed" : corridor.status === "Good" ? "Good" : corridor.status
  const raised = notice && toneRank(notice.tone) > toneRank(tone) ? notice : null
  return {
    id,
    ...PLACES[id],
    status: raised ? raised.status : status,
    detail: notice?.detail || corridor.detail,
    tone: raised ? raised.tone : tone,
  }
}

function fromNotices(id: keyof typeof PLACES, disruptions: readonly DisruptionLike[], pattern: RegExp): ThamesCrossing {
  const notice = worstNotice(disruptions, pattern)
  return {
    id,
    ...PLACES[id],
    status: notice ? notice.status : "No disruption",
    detail: notice?.detail ?? "",
    tone: notice ? notice.tone : "green",
  }
}

// The most serious active notice naming this crossing. A closure outranks any severity.
function worstNotice(disruptions: readonly DisruptionLike[], pattern: RegExp): { status: string; detail: string; tone: CrossingTone } | null {
  let worst: { properties: Record<string, unknown>; weight: number } | null = null
  for (const item of disruptions) {
    const properties = item.properties ?? {}
    if (!pattern.test(`${prop(properties, "location")} ${prop(properties, "comments")}`)) continue
    const weight = properties.closure === true ? 9 : typeof properties.rank === "number" ? properties.rank : 0
    if (!worst || weight > worst.weight) worst = { properties, weight }
  }
  if (!worst) return null
  const detail = prop(worst.properties, "title") || prop(worst.properties, "comments")
  if (worst.weight === 9) return { status: "Closed", detail, tone: "red" }
  if (worst.weight >= 3) return { status: prop(worst.properties, "severity"), detail, tone: "red" }
  if (worst.weight >= 2) return { status: prop(worst.properties, "severity"), detail, tone: "amber" }
  return { status: "Minor notice", detail, tone: "green" }
}

function toneRank(tone: CrossingTone): number {
  return tone === "red" ? 3 : tone === "amber" ? 2 : tone === "green" ? 1 : 0
}

function prop(properties: Record<string, unknown>, key: string): string {
  const value = properties[key]
  return typeof value === "string" ? value : ""
}

// Road user charging points, drawn with the Congestion Charge and ULEZ zones.
export const CHARGE_POINTS: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    charge("Dartford Crossing", "Dart Charge, paid online. Free 22:00 to 06:00.", [0.2596, 51.4655]),
    charge("Blackwall Tunnel", "Tunnel user charge, both directions, since April 2025.", [0.0043, 51.5065]),
    charge("Silvertown Tunnel", "Tunnel user charge, both directions, since April 2025.", [0.0117, 51.5022]),
  ],
}

function charge(name: string, detail: string, coordinates: [number, number]): GeoJSON.Feature {
  return { type: "Feature", properties: { name, detail }, geometry: { type: "Point", coordinates } }
}
