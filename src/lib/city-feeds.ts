import type { AirSite, CycleDock, PlanningApp, PlanningStage } from "./types.ts"

// Santander Cycles docking stations from TfL BikePoint.
export function parseBikePoints(rows: Record<string, unknown>[]): CycleDock[] {
  return rows.flatMap((row) => {
    const props: Record<string, string> = {}
    if (Array.isArray(row.additionalProperties)) {
      for (const item of row.additionalProperties as unknown[]) {
        if (typeof item !== "object" || item === null) continue
        const { key, value } = item as { key?: unknown; value?: unknown }
        if (typeof key === "string" && typeof value === "string") props[key] = value
      }
    }
    const id = typeof row.id === "string" ? row.id : ""
    const lng = typeof row.lon === "number" ? row.lon : NaN
    const lat = typeof row.lat === "number" ? row.lat : NaN
    if (!id || !Number.isFinite(lng) || !Number.isFinite(lat)) return []
    if (props.Installed === "false" || props.Locked === "true") return []
    const bikes = whole(props.NbStandardBikes ?? props.NbBikes)
    const ebikes = whole(props.NbEBikes)
    return [
      {
        id,
        name: typeof row.commonName === "string" ? row.commonName.trim() : id,
        lng,
        lat,
        bikes,
        ebikes,
        empty: whole(props.NbEmptyDocks),
        docks: whole(props.NbDocks),
      },
    ]
  })
}

// London Air Quality Network hourly index, 1 (low) to 10 (very high), per site.
// A site reports several pollutants; the worst one is the site's index.
export function parseLaqn(payload: unknown): AirSite[] {
  const root = field(field(payload, "HourlyAirQualityIndex"), "LocalAuthority")
  const authorities = Array.isArray(root) ? root : root ? [root] : []
  const sites: AirSite[] = []
  for (const authority of authorities) {
    const raw = field(authority, "Site")
    const list = Array.isArray(raw) ? raw : raw ? [raw] : []
    for (const site of list) {
      const lng = Number(field(site, "@Longitude"))
      const lat = Number(field(site, "@Latitude"))
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng === 0) continue
      const speciesRaw = field(site, "Species")
      const species = Array.isArray(speciesRaw) ? speciesRaw : speciesRaw ? [speciesRaw] : []
      let worst: { index: number; band: string; code: string } | null = null
      for (const item of species) {
        const index = Number(field(item, "@AirQualityIndex"))
        const band = String(field(item, "@AirQualityBand") ?? "")
        if (!Number.isFinite(index) || index <= 0 || /no data/i.test(band)) continue
        if (!worst || index > worst.index) worst = { index, band, code: String(field(item, "@SpeciesCode") ?? "") }
      }
      sites.push({
        code: String(field(site, "@SiteCode") ?? ""),
        name: String(field(site, "@SiteName") ?? ""),
        lng,
        lat,
        index: worst?.index ?? null,
        band: worst?.band ?? "No data",
        species: worst?.code ?? "",
      })
    }
  }
  return sites
}

// GLA Planning London Datahub. "Commenced" means work has started on site.
export function planningStage(status: string): PlanningStage {
  if (/commenced/i.test(status)) return "building"
  if (/received|consideration|appeal in progress|appeal received/i.test(status)) return "pending"
  return "decided"
}

export function parsePlanningHits(payload: unknown): PlanningApp[] {
  const hits = field(field(payload, "hits"), "hits")
  if (!Array.isArray(hits)) return []
  return hits.flatMap((hit) => {
    const source = field(hit, "_source")
    const centroid = field(source, "centroid")
    const lng = Number(field(centroid, "lon"))
    const lat = Number(field(centroid, "lat"))
    const id = String(field(source, "id") ?? "")
    if (!id || !Number.isFinite(lng) || !Number.isFinite(lat)) return []
    const status = String(field(source, "status") ?? "").trim()
    const siteParts = [field(source, "site_number"), field(source, "site_name"), field(source, "street_name"), field(source, "postcode")]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean)
    return [
      {
        id,
        authority: String(field(source, "lpa_name") ?? ""),
        status,
        stage: planningStage(status),
        description: String(field(source, "description") ?? "").trim(),
        site: siteParts.join(", "),
        validDate: String(field(source, "valid_date") ?? ""),
        commencedDate: String(field(source, "actual_commencement_date") ?? ""),
        lng,
        lat,
      },
    ]
  })
}

function whole(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0
}

function field(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined
  const result = (value as Record<string, unknown>)[key]
  return result === null ? undefined : result
}
