import type { WeatherConditions, WeatherWarning } from "./types.ts"

export const EMPTY_CONDITIONS: WeatherConditions = {
  temperatureC: null,
  rainfallMm: null,
  rainfallPlace: "",
}

const COLOUR_SCORE: Record<string, { score: number; tone: "red" | "amber"; urgent: boolean }> = {
  red: { score: 900_000, tone: "red", urgent: true },
  amber: { score: 700_000, tone: "red", urgent: true },
  yellow: { score: 150_000, tone: "amber", urgent: false },
}

// Met Office National Severe Weather Warnings for London & South East England.
// Item titles read "Yellow warning of rain affecting London & South East England".
export function parseMetOfficeRss(xml: string): WeatherWarning[] {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1] ?? "")
  return items.flatMap((item, index) => {
    const title = decode(tag(item, "title"))
    const match = title.match(/^(Red|Amber|Yellow)\s+warning\s+of\s+(.+?)(?:\s+affecting\s+.*)?$/i)
    if (!match?.[1] || !match[2]) return []
    const colour = match[1].toLowerCase()
    const hazard = match[2].trim()
    const level = COLOUR_SCORE[colour]
    if (!level) return []
    const name = `${capital(colour)} warning: ${hazard}`
    return [
      {
        id: `metoffice-${colour}-${hazard.toLowerCase().replace(/\W+/g, "-")}-${index}`,
        kind: "weather" as const,
        name,
        shortName: `${capital(colour)} ${hazard}`,
        detail: clip(stripTags(decode(tag(item, "description"))), 220),
        tone: level.tone,
        urgent: level.urgent,
        score: level.score,
      },
    ]
  })
}

// Greater London with a margin, as [west, south, east, north].
const LONDON_BOX: [number, number, number, number] = [-0.56, 51.26, 0.35, 51.71]

// Met Office NSWWS v1.1: each warning is a MultiPolygon with its level, weather
// types and headline. Only warnings whose area reaches Greater London are kept,
// where the RSS feed can only say "London & South East England".
export function parseNswws(payload: unknown): { warnings: WeatherWarning[]; areas: GeoJSON.FeatureCollection } {
  const warnings: WeatherWarning[] = []
  const areas: GeoJSON.Feature[] = []
  const features = typeof payload === "object" && payload !== null && "features" in payload && Array.isArray(payload.features) ? payload.features : []
  for (const raw of features as unknown[]) {
    if (typeof raw !== "object" || raw === null) continue
    const feature = raw as { properties?: Record<string, unknown>; geometry?: GeoJSON.Geometry | null }
    const properties = feature.properties ?? {}
    const geometry = feature.geometry
    if (!geometry || (geometry.type !== "MultiPolygon" && geometry.type !== "Polygon")) continue
    if (typeof properties.warningStatus === "string" && !/issued/i.test(properties.warningStatus)) continue
    const colour = typeof properties.warningLevel === "string" ? properties.warningLevel.toLowerCase() : ""
    const level = COLOUR_SCORE[colour]
    if (!level) continue
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates
    const box = boundsOf(polygons)
    if (!box || !overlaps(box, LONDON_BOX)) continue
    const types = Array.isArray(properties.weatherType) ? properties.weatherType.filter((item): item is string => typeof item === "string") : []
    const hazard = types.map((item) => item.toLowerCase().replace(/_/g, " ")).join(", ") || "weather"
    const likelihood = typeof properties.warningLikelihood === "number" ? properties.warningLikelihood : 0
    const id = `nswws-${typeof properties.warningId === "string" ? properties.warningId : warnings.length}`
    const headline = typeof properties.warningHeadline === "string" ? properties.warningHeadline.trim() : ""
    const name = `${capital(colour)} warning: ${hazard}`
    warnings.push({
      id,
      kind: "weather",
      name,
      shortName: `${capital(colour)} ${hazard}`,
      detail: clip([headline, validity(properties)].filter(Boolean).join(" · "), 220),
      tone: level.tone,
      urgent: level.urgent,
      score: level.score + likelihood,
      coordinates: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2],
    })
    areas.push({ type: "Feature", properties: { id, level: colour, name }, geometry })
  }
  return { warnings, areas: { type: "FeatureCollection", features: areas } }
}

// The Atom feed links the snapshot of all warnings in force.
export function nswwsSnapshotUrl(xml: string): string | null {
  const link = xml.match(/<link[^>]*rel="related"[^>]*href="([^"]+)"/)?.[1] ?? null
  return link && link.startsWith("https://data.hub.api.metoffice.gov.uk/") ? link : null
}

function validity(properties: Record<string, unknown>): string {
  const from = typeof properties.validFromDate === "string" ? Date.parse(properties.validFromDate) : NaN
  const to = typeof properties.validToDate === "string" ? Date.parse(properties.validToDate) : NaN
  if (!Number.isFinite(from) || !Number.isFinite(to)) return ""
  const format = (value: number) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value)
  return `${format(from)} to ${format(to)}`
}

function boundsOf(polygons: GeoJSON.Position[][][]): [number, number, number, number] | null {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        if (typeof lng !== "number" || typeof lat !== "number") continue
        west = Math.min(west, lng)
        east = Math.max(east, lng)
        south = Math.min(south, lat)
        north = Math.max(north, lat)
      }
    }
  }
  return Number.isFinite(west) ? [west, south, east, north] : null
}

function overlaps(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
}

const FLOOD_LEVEL: Record<number, { label: string; score: number; tone: "red" | "amber"; urgent: boolean }> = {
  1: { label: "Severe flood warning", score: 950_000, tone: "red", urgent: true },
  2: { label: "Flood warning", score: 650_000, tone: "red", urgent: true },
  3: { label: "Flood alert", score: 140_000, tone: "amber", urgent: false },
}

// Environment Agency flood warnings in force. Level 4 means the warning was lifted.
export function parseFloods(payload: unknown): WeatherWarning[] {
  if (typeof payload !== "object" || payload === null || !("items" in payload) || !Array.isArray(payload.items)) return []
  return payload.items.flatMap((raw: unknown) => {
    if (typeof raw !== "object" || raw === null) return []
    const row = raw as Record<string, unknown>
    const level = typeof row.severityLevel === "number" ? FLOOD_LEVEL[row.severityLevel] : undefined
    if (!level) return []
    const area = typeof row.description === "string" ? row.description.trim() : ""
    const id = typeof row.floodAreaID === "string" ? row.floodAreaID : area
    return [
      {
        id: `flood-${id}`,
        kind: "flood" as const,
        name: area ? `${level.label}: ${area}` : level.label,
        shortName: level.tone === "red" ? "Flood" : "Flood alert",
        detail: clip(typeof row.message === "string" ? row.message.trim() : "", 220),
        tone: level.tone,
        urgent: level.urgent,
        score: level.score,
      },
    ]
  })
}

const RAIN_STALE_MS = 60 * 60_000

// The heaviest latest 15-minute reading across the London gauges. A gauge that
// stopped reporting keeps an old "latest" value, so readings over an hour old are left out.
export function heaviestRain(payload: unknown, stations: ReadonlySet<string>, now: number): number | null {
  if (typeof payload !== "object" || payload === null || !("items" in payload) || !Array.isArray(payload.items)) return null
  let heaviest: number | null = null
  for (const raw of payload.items as unknown[]) {
    if (typeof raw !== "object" || raw === null) continue
    const row = raw as { measure?: unknown; value?: unknown; dateTime?: unknown }
    const measure = typeof row.measure === "string" ? row.measure : ""
    const station = measure.match(/\/measures\/([^-]+)-rainfall/)?.[1] ?? ""
    if (!stations.has(station) || typeof row.value !== "number" || !Number.isFinite(row.value) || row.value < 0) continue
    const at = typeof row.dateTime === "string" ? Date.parse(row.dateTime) : NaN
    if (!Number.isFinite(at) || now - at > RAIN_STALE_MS) continue
    if (heaviest == null || row.value > heaviest) heaviest = row.value
  }
  return heaviest == null ? null : Math.round(heaviest * 10) / 10
}

export function rainStations(payload: unknown): Set<string> {
  const out = new Set<string>()
  if (typeof payload !== "object" || payload === null || !("items" in payload) || !Array.isArray(payload.items)) return out
  for (const raw of payload.items as unknown[]) {
    if (typeof raw === "object" && raw !== null && "notation" in raw && typeof raw.notation === "string") out.add(raw.notation)
  }
  return out
}

export function parseTemperature(payload: unknown): number | null {
  if (typeof payload !== "object" || payload === null || !("current" in payload)) return null
  const current = payload.current
  if (typeof current !== "object" || current === null || !("temperature_2m" in current)) return null
  const value = current.temperature_2m
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function weatherBar(
  warnings: WeatherWarning[],
  conditions: WeatherConditions | null,
): { label: string; tone: "red" | "amber" | "green" } | null {
  const first = warnings[0]
  if (first) {
    const second = warnings[1]
    const extra = warnings.length - (second ? 2 : 1)
    const names = second ? `${first.shortName} · ${second.shortName}` : first.shortName
    return {
      label: extra > 0 ? `${first.shortName} +${warnings.length - 1}` : names,
      tone: first.tone,
    }
  }
  if (!conditions || (conditions.temperatureC == null && conditions.rainfallMm == null)) return null
  const temperature = conditions.temperatureC == null ? "" : `${Math.round(conditions.temperatureC)}°C`
  const rain = conditions.rainfallMm == null ? "" : conditions.rainfallMm > 0 ? `${conditions.rainfallMm} mm` : "Dry"
  const wet = conditions.rainfallMm != null && conditions.rainfallMm >= 4
  const hot = conditions.temperatureC != null && conditions.temperatureC >= 30
  return { label: [temperature, rain].filter(Boolean).join(" · "), tone: wet || hot ? "amber" : "green" }
}

function tag(xml: string, name: string): string {
  const match = xml.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`))
  return match?.[1]?.trim() ?? ""
}

function decode(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function capital(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function clip(value: string, limit: number): string {
  if (value.length <= limit) return value
  return `${value.slice(0, limit - 1).trimEnd()}…`
}
