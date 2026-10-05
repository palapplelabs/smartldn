import type { BoardFault } from "./board-status.ts"
import type { Messages } from "./i18n.ts"
import type { AirSite, Corridor, LiftOutage, LineStatus, ThamesCrossing, WeatherConditions, WeatherWarning } from "./types.ts"

export type IntelKind = "fault" | "incident" | "crossing" | "jam" | "works" | "slow" | "line" | "lift" | "weather" | "air"

export type IntelTone = "red" | "amber" | "green" | "none"

export type IntelItem = {
  id: string
  kind: IntelKind
  score: number
  urgent: boolean
  label: string
  title: string
  detail: string
  tone: IntelTone
  coordinates: [number, number] | null
}

export type IntelTab = "ranked" | "roads" | "transit" | "weather" | "systems" | "notes"

export const INTEL_TABS: readonly IntelTab[] = ["ranked", "roads", "transit", "weather", "systems", "notes"]

export type FeedFaults = {
  roads: string | null
  disruptions: string | null
  status: string | null
  weather: string | null
  cameras: string | null
  rail: string | null
  light: string | null
  river: string | null
  buses: string | null
  cycles: string | null
  air: string | null
  planning: string | null
  map: string | null
}

export type IntelInput = {
  faults: FeedFaults
  corridors: Corridor[]
  incidents: GeoJSON.FeatureCollection | null
  works: GeoJSON.FeatureCollection | null
  crossings: ThamesCrossing[]
  lines: LineStatus[]
  lifts: LiftOutage[]
  warnings: WeatherWarning[]
  warningsReady: boolean
  conditions: WeatherConditions | null
  air: AirSite[]
  boardFaults?: readonly BoardFault[]
}

const RANKED_LIMIT = 12
const URGENT = 500_000

export function intelBoard(input: IntelInput, m: Messages): Record<IntelTab, IntelItem[]> {
  const faults = faultsOf(input.faults, m)
  const incidents = incidentsOf(input.incidents, m)
  const corridors = corridorsOf(input.corridors, m)
  const crossings = crossingsOf(input.crossings, m)
  const works = worksOf(input.works, m)
  const lines = linesOf(input.lines, m)
  const lifts = liftsOf(input.lifts, m)
  const warnings = warningsOf(input.warnings, m)
  const air = airOf(input.air, m)
  const ranked = [
    ...faults,
    ...incidents.filter((item) => item.tone !== "green").slice(0, 5),
    ...crossings.filter((item) => item.tone !== "green"),
    ...corridors.slice(0, 6),
    ...lines.filter((item) => item.tone !== "green").slice(0, 6),
    ...works.slice(0, 4),
    ...warnings,
    ...air.filter((item) => item.urgent),
  ].sort(byScore)
  const roadFaults = faults.filter((item) => item.id === "fault-roads" || item.id === "fault-disruptions")
  return {
    ranked: ranked.slice(0, RANKED_LIMIT),
    roads: [...roadFaults, ...incidents, ...crossings.filter((item) => item.tone !== "green"), ...corridors, ...works].sort(byScore).slice(0, 20),
    transit: [...faults.filter((item) => item.id === "fault-status"), ...lines.filter((item) => item.tone !== "green"), ...lifts].sort(byScore),
    weather: weatherOf(input, warnings, air, m),
    systems: [...faults, ...boardFaultItems(input.boardFaults ?? [], m)].sort(byScore),
    notes: [],
  }
}

export function rankIntel(input: IntelInput, m: Messages): IntelItem[] {
  return intelBoard(input, m).ranked
}

function faultsOf(faults: FeedFaults, m: Messages): IntelItem[] {
  const feeds: { id: string; score: number; title: string; detail: string | null }[] = [
    { id: "fault-map", score: 1_200_000, title: m.mapFailed, detail: faults.map },
    { id: "fault-roads", score: 1_000_000, title: m.faultRoads, detail: faults.roads },
    { id: "fault-status", score: 900_000, title: m.faultStatus, detail: faults.status },
    { id: "fault-disruptions", score: 640_000, title: m.faultDisruptions, detail: faults.disruptions },
    { id: "fault-cameras", score: 420_000, title: m.camerasFailed, detail: faults.cameras },
    { id: "fault-rail", score: 400_000, title: m.railFailed, detail: faults.rail },
    { id: "fault-light", score: 380_000, title: m.lightFailed, detail: faults.light },
    { id: "fault-river", score: 340_000, title: m.riverFailed, detail: faults.river },
    { id: "fault-buses", score: 330_000, title: m.busPositionsFailed, detail: faults.buses },
    { id: "fault-cycles", score: 200_000, title: m.cyclesFailed, detail: faults.cycles },
    { id: "fault-weather", score: 160_000, title: m.faultWeather, detail: faults.weather },
    { id: "fault-air", score: 120_000, title: m.airFailed, detail: faults.air },
    { id: "fault-planning", score: 100_000, title: m.planningFailed, detail: faults.planning },
  ]
  return feeds.flatMap((feed) => (feed.detail ? [fault(feed.id, feed.score, feed.title, feed.detail, m)] : []))
}

function boardFaultItems(faults: readonly BoardFault[], m: Messages): IntelItem[] {
  return faults.map((item) => fault(`fault-board-${item.id}`, 360_000, m.busFailed, item.name, m))
}

function fault(id: string, score: number, title: string, detail: string, m: Messages): IntelItem {
  return {
    id,
    kind: "fault",
    score,
    urgent: score >= URGENT,
    label: m.fault,
    title,
    detail,
    tone: score >= URGENT ? "red" : "amber",
    coordinates: null,
  }
}

function incidentsOf(collection: GeoJSON.FeatureCollection | null, m: Messages): IntelItem[] {
  if (!collection) return []
  return collection.features
    .map((feature, index) => {
      const properties = feature.properties
      const rank = numberProp(properties, "rank") ?? 0
      const closure = properties?.closure === true
      const red = closure || rank >= 3
      const amber = !red && rank >= 2
      return {
        id: `incident-${textProp(properties, "id") || index}`,
        kind: "incident" as const,
        score: (red ? 800_000 : amber ? 300_000 : 40_000) + rank * 1_000 - index,
        urgent: red,
        label: textProp(properties, "category") || m.incident,
        title: clip(textProp(properties, "title") || m.incident, 90),
        detail: [textProp(properties, "severity"), clip(textProp(properties, "location"), 80)].filter(Boolean).join(" · "),
        tone: (red ? "red" : amber ? "amber" : "green") as IntelTone,
        coordinates: pointOf(feature),
      }
    })
    .sort(byScore)
}

function corridorsOf(corridors: Corridor[], m: Messages): IntelItem[] {
  return corridors
    .flatMap((corridor) => {
      if (corridor.band !== "congested" && corridor.band !== "slow") return []
      const jam = corridor.band === "congested"
      return [
        {
          id: `corridor-${corridor.id}`,
          kind: (jam ? "jam" : "slow") as IntelKind,
          score: corridor.closed ? 650_000 : jam ? 600_000 : 250_000,
          urgent: jam,
          label: corridor.closed ? m.closed : jam ? m.bad : m.average,
          title: corridor.name,
          detail: corridor.detail,
          tone: (jam ? "red" : "amber") as IntelTone,
          coordinates: midpoint(corridor.paths),
        },
      ]
    })
    .sort(byScore)
}

function crossingsOf(crossings: ThamesCrossing[], m: Messages): IntelItem[] {
  return crossings.map((crossing) => ({
    id: `crossing-${crossing.id}`,
    kind: "crossing" as const,
    score: crossing.tone === "red" ? 620_000 : crossing.tone === "amber" ? 220_000 : 5_000,
    urgent: crossing.tone === "red",
    label: m.crossing,
    title: `${crossing.name}: ${crossing.status}`,
    detail: clip(crossing.detail, 100),
    tone: crossing.tone,
    coordinates: crossing.coordinates,
  }))
}

function worksOf(collection: GeoJSON.FeatureCollection | null, m: Messages): IntelItem[] {
  if (!collection) return []
  return collection.features
    .flatMap((feature) => {
      const properties = feature.properties
      const rank = numberProp(properties, "rank") ?? 0
      const closure = properties?.closure === true
      if (rank < 2 && !closure) return []
      return [
        {
          id: `works-${textProp(properties, "id")}`,
          kind: "works" as const,
          score: closure ? 300_000 : rank >= 3 ? 260_000 : 100_000,
          urgent: false,
          label: m.works,
          title: clip(textProp(properties, "title") || m.roadWork, 90),
          detail: [closure ? m.closed : textProp(properties, "severity"), clip(textProp(properties, "location"), 80)].filter(Boolean).join(" · "),
          tone: (closure || rank >= 3 ? "red" : "amber") as IntelTone,
          coordinates: pointOf(feature),
        },
      ]
    })
    .sort(byScore)
}

function linesOf(lines: LineStatus[], m: Messages): IntelItem[] {
  return lines.map((line) => ({
    id: `line-${line.id}`,
    kind: "line" as const,
    score: line.tone === "red" ? 700_000 + (20 - line.severity) : line.tone === "amber" ? 180_000 + (20 - line.severity) : 0,
    urgent: line.tone === "red",
    label: m.lineLabel,
    title: `${line.name}: ${line.status}`,
    detail: clip(line.reason.replace(/^[^:]{1,60}:\s*/, ""), 160),
    tone: line.tone,
    coordinates: null,
  }))
}

function liftsOf(lifts: LiftOutage[], m: Messages): IntelItem[] {
  return lifts.map((lift, index) => ({
    id: `lift-${lift.station}-${index}`,
    kind: "lift" as const,
    score: 30_000 - index,
    urgent: false,
    label: m.liftOutage,
    title: lift.station,
    detail: clip(lift.message.replace(/^[^:]{1,60}:\s*/, ""), 160),
    tone: "amber" as const,
    coordinates: null,
  }))
}

function warningsOf(warnings: WeatherWarning[], m: Messages): IntelItem[] {
  return warnings.map((warning) => ({
    id: warning.id,
    kind: "weather" as const,
    score: warning.score,
    urgent: warning.urgent,
    label: m.weather,
    title: warning.name,
    detail: warning.detail,
    tone: warning.tone,
    coordinates: warning.coordinates ?? null,
  }))
}

// LAQN bands: 1–3 Low, 4–6 Moderate, 7–9 High, 10 Very High.
function airOf(sites: AirSite[], m: Messages): IntelItem[] {
  return sites
    .flatMap((site) => {
      if (site.index == null || site.index < 7) return []
      const veryHigh = site.index >= 10
      return [
        {
          id: `air-${site.code}`,
          kind: "air" as const,
          score: veryHigh ? 400_000 : 150_000 + site.index,
          urgent: veryHigh,
          label: m.air,
          title: site.name,
          detail: m.airIndex(site.band, site.index),
          tone: (veryHigh ? "red" : "amber") as IntelTone,
          coordinates: [site.lng, site.lat] as [number, number],
        },
      ]
    })
    .sort(byScore)
}

function weatherOf(input: IntelInput, warnings: IntelItem[], air: IntelItem[], m: Messages): IntelItem[] {
  if (!input.warningsReady && !input.conditions) return []
  const items: IntelItem[] = []
  if (input.faults.weather) items.push(fault("fault-weather", 160_000, m.faultWeather, input.faults.weather, m))
  items.push(...warnings, ...air.slice(0, 4))
  const conditions = conditionsItem(input.conditions, m)
  if (conditions) items.push(conditions)
  return items
}

function conditionsItem(conditions: WeatherConditions | null, m: Messages): IntelItem | null {
  if (!conditions) return null
  const temperature = conditions.temperatureC
  const rainfall = conditions.rainfallMm
  if (temperature == null && rainfall == null) return null
  const hot = temperature != null && temperature >= 30
  const wet = rainfall != null && rainfall >= 4
  const rainDetail = rainfall == null ? "" : rainfall <= 0 ? m.noRain : m.rainRecent(conditions.rainfallPlace, rainfall)
  return {
    id: "weather-conditions",
    kind: "weather",
    score: 1,
    urgent: rainfall != null && rainfall >= 8,
    label: m.conditions,
    title: temperature == null ? m.noReading : m.temperature(Math.round(temperature)),
    detail: rainDetail,
    tone: rainfall != null && rainfall >= 8 ? "red" : wet || hot ? "amber" : "green",
    coordinates: null,
  }
}

function byScore(a: IntelItem, b: IntelItem): number {
  return b.score - a.score || a.title.localeCompare(b.title)
}

function midpoint(paths: [number, number][][]): [number, number] | null {
  const longest = paths.reduce<[number, number][] | null>((best, path) => (!best || path.length > best.length ? path : best), null)
  if (!longest) return null
  return longest[Math.floor(longest.length / 2)] ?? null
}

function pointOf(feature: GeoJSON.Feature): [number, number] | null {
  const geometry = feature.geometry
  if (geometry.type !== "Point") return null
  const [lng, lat] = geometry.coordinates
  if (typeof lng !== "number" || typeof lat !== "number") return null
  return [lng, lat]
}

function textProp(properties: GeoJSON.GeoJsonProperties, key: string): string {
  if (!properties) return ""
  const value = properties[key]
  return typeof value === "string" ? value.trim() : ""
}

function numberProp(properties: GeoJSON.GeoJsonProperties, key: string): number | null {
  if (!properties) return null
  const value = properties[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function clip(value: string, limit: number): string {
  if (value.length <= limit) return value
  return `${value.slice(0, limit - 1).trimEnd()}…`
}
