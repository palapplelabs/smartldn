import type { NationalBoard, NationalCall, NationalDeparture, NationalStation } from "./types.ts"

// National Rail through the Rail Data Marketplace: the Knowledgebase station
// list (where London's stations are), Darwin's live departure boards, and the
// calling points of one service. Each response is cut to what the map shows.

// TfL publishes a status line for every train operator. These are the ones that
// run into or across London; the rest (ScotRail, Merseyrail…) never appear here.
export const LONDON_OPERATORS: Readonly<Record<string, string>> = {
  "avanti-west-coast": "#004354",
  c2c: "#B7007C",
  "chiltern-railways": "#00BFFF",
  "east-midlands-railway": "#4C2F48",
  "gatwick-express": "#EB1E2D",
  "grand-central": "#1D1D1B",
  "great-northern": "#00A6E6",
  "great-western-railway": "#0A493E",
  "greater-anglia": "#D70428",
  "heathrow-express": "#532E63",
  "hull-trains": "#DE005C",
  "london-north-eastern-railway": "#CE0E2D",
  lumo: "#2B6EF2",
  southeastern: "#389CFF",
  southern: "#8CC63E",
  "south-western-railway": "#24398C",
  thameslink: "#FF5AA4",
  "west-midlands-trains": "#FF8300",
}

const CRS = /^[A-Z]{3}$/

export function isCrs(value: string): boolean {
  return CRS.test(value)
}

export function parseStations(body: unknown, within: (lng: number, lat: number) => boolean): NationalStation[] {
  const rows = field(body, "stations")
  if (!Array.isArray(rows)) return []
  return rows.flatMap((row): NationalStation[] => {
    const crs = str(row, "crsCode")
    const location = field(row, "location")
    const lat = num(location, "latitude")
    const lng = num(location, "longitude")
    if (!isCrs(crs) || lat == null || lng == null || !within(lng, lat)) return []
    const alerts = field(row, "stationAlerts")
    return [
      {
        crs,
        name: str(row, "name") || crs,
        lng: round(lng),
        lat: round(lat),
        operator: str(field(row, "stationOperator"), "name"),
        stepFree: stepFreeCategory(str(field(field(row, "stationAccessibility"), "stepFreeCategory"), "category")),
        alerts: Array.isArray(alerts)
          ? alerts.flatMap((alert) => {
              const text = plainText(str(alert, "alertText"))
              return text ? [clip(text, 220)] : []
            })
          : [],
      },
    ]
  })
}

// "A, Compliant step-free access to all platform(s)" → "A"
function stepFreeCategory(category: string): string {
  const letter = category.match(/^([A-Z])\b/)?.[1]
  return letter ?? ""
}

export function parseBoard(body: unknown): NationalBoard | null {
  const crs = str(body, "crs")
  if (!isCrs(crs)) return null
  const services = field(body, "trainServices")
  const departures = Array.isArray(services) ? services.flatMap(departure) : []
  const notices = field(body, "nrccMessages")
  return {
    crs,
    name: str(body, "locationName") || crs,
    generatedAt: str(body, "generatedAt"),
    departures,
    notices: Array.isArray(notices) ? notices.flatMap((notice) => {
      const text = plainText(str(notice, "Value") || str(notice, "value"))
      return text ? [clip(text, 240)] : []
    }) : [],
  }
}

function departure(row: unknown): NationalDeparture[] {
  const id = str(row, "serviceID")
  const scheduled = str(row, "std")
  if (!id || !scheduled) return []
  const destination = field(row, "destination")
  const names = Array.isArray(destination) ? destination.map((place) => str(place, "locationName")).filter(Boolean) : []
  return [
    {
      id,
      scheduled,
      expected: str(row, "etd"),
      destination: names.join(" & ") || "",
      platform: str(row, "platform"),
      operator: str(row, "operator"),
      cancelled: field(row, "isCancelled") === true,
      reason: str(row, "cancelReason") || str(row, "delayReason"),
      coaches: (num(row, "length") ?? 0) > 0 ? num(row, "length") : null,
    },
  ]
}

// The stops still ahead of a service, with Darwin's live estimate for each.
export function parseCallingPoints(body: unknown): NationalCall[] {
  const groups = field(body, "subsequentCallingPoints")
  if (!Array.isArray(groups)) return []
  const first = field(groups[0], "callingPoint")
  if (!Array.isArray(first)) return []
  return first.flatMap((point): NationalCall[] => {
    const name = str(point, "locationName")
    const scheduled = str(point, "st")
    if (!name || !scheduled) return []
    return [{ name, crs: str(point, "crs"), scheduled, expected: str(point, "et"), cancelled: field(point, "isCancelled") === true }]
  })
}

// Darwin writes "On time", "Delayed", "Cancelled" or a time such as "23:42".
export function departureState(row: Pick<NationalDeparture, "scheduled" | "expected" | "cancelled">): { label: string; tone: "green" | "amber" | "red" } {
  if (row.cancelled || /cancel/i.test(row.expected)) return { label: "Cancelled", tone: "red" }
  if (!row.expected || /on time/i.test(row.expected) || row.expected === row.scheduled) return { label: "On time", tone: "green" }
  if (/^\d{2}:\d{2}$/.test(row.expected)) return { label: `Exp ${row.expected}`, tone: "amber" }
  return { label: row.expected, tone: "amber" }
}

export function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function clip(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1).trimEnd()}…`
}

function round(value: number): number {
  return Math.round(value * 1e5) / 1e5
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
