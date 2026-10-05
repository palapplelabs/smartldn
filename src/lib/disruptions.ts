// TfL road disruptions: works, incidents, hazards, events and asset faults from
// the TfL traffic control centre. Each one comes with its own point, so the map
// does not have to guess where a notice belongs.

export type DisruptionSplit = {
  works: GeoJSON.FeatureCollection
  incidents: GeoJSON.FeatureCollection
}

const SEVERITY_RANK: Record<string, number> = {
  severe: 4,
  serious: 3,
  moderate: 2,
  minimal: 1,
  "no impact": 0,
}

export function severityRank(severity: string): number {
  return SEVERITY_RANK[severity.trim().toLowerCase()] ?? 0
}

export function isWorks(category: string): boolean {
  return /works/i.test(category)
}

export function splitDisruptions(rows: Record<string, unknown>[]): DisruptionSplit {
  const works: GeoJSON.Feature[] = []
  const incidents: GeoJSON.Feature[] = []
  for (const row of rows) {
    const status = str(row, "status")
    if (status && !/active/i.test(status)) continue
    const point = pointOf(row)
    if (!point) continue
    const category = str(row, "category")
    const severity = str(row, "severity")
    const comments = str(row, "comments")
    const feature: GeoJSON.Feature = {
      type: "Feature",
      properties: {
        id: str(row, "id"),
        title: headline(comments) || category,
        location: str(row, "location"),
        category,
        subCategory: str(row, "subCategory"),
        severity,
        rank: severityRank(severity),
        comments,
        update: str(row, "currentUpdate"),
        updatedAt: str(row, "currentUpdateDateTime") || str(row, "lastModifiedTime"),
        start: str(row, "startDateTime"),
        end: str(row, "endDateTime"),
        closure: row.hasClosures === true || /closure/i.test(severity),
        corridors: corridorList(row.corridorIds),
      },
      geometry: { type: "Point", coordinates: point },
    }
    if (isWorks(category)) works.push(feature)
    else incidents.push(feature)
  }
  return {
    works: { type: "FeatureCollection", features: works },
    incidents: { type: "FeatureCollection", features: incidents },
  }
}

// "A406 Brent Cross flyover renewals - [A406] North Circular Road ..." → the part before the first " - ".
export function headline(comments: string): string {
  const first = comments.split(/\s+-\s+/)[0] ?? ""
  return first.replace(/\[|\]/g, "").trim().slice(0, 120)
}

function pointOf(row: Record<string, unknown>): [number, number] | null {
  const raw = str(row, "point")
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const [lng, lat] = parsed
    if (typeof lng !== "number" || typeof lat !== "number") return null
    if (lng < -1 || lng > 1 || lat < 51 || lat > 52) return null
    return [lng, lat]
  } catch {
    return null
  }
}

function corridorList(value: unknown): string {
  if (!Array.isArray(value)) return ""
  return value.filter((item): item is string => typeof item === "string").join(",")
}

function str(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  return typeof value === "string" ? value.trim() : ""
}
