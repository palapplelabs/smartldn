import { parsePlanningHits } from "@/lib/city-feeds"
import { errorText } from "@/lib/snapshot-route"
import { fetchUpstream } from "@/lib/upstream"
import { viewCachedGet } from "@/lib/view-cache"
import { inLondon, stopReachMetres, viewCacheKey } from "@/lib/view-reach"
import type { PlanningResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

const SEARCH_URL = "https://planningdata.london.gov.uk/api-guest/applications/_search"
const RECENT_DAYS = 120
const CAP = 150

// Sites where work has started, plus applications validated in the last four months.
export const GET = viewCachedGet<PlanningResponse>({
  freshMs: 6 * 60 * 60 * 1000,
  cacheKey: viewCacheKey,
  async load(lng, lat, now, zoom) {
    if (!inLondon(lng, lat)) return { ok: true, apps: [] }
    const reach = Math.min(2_000, stopReachMetres(zoom, lat))
    const dLat = reach / 110_540
    const dLng = reach / (111_320 * Math.cos((lat * Math.PI) / 180))
    const since = new Date(now - RECENT_DAYS * 86_400_000)
    const query = {
      size: CAP,
      _source: ["id", "lpa_name", "status", "description", "site_number", "site_name", "street_name", "postcode", "valid_date", "actual_commencement_date", "centroid"],
      sort: [{ valid_date: { order: "desc" } }],
      query: {
        bool: {
          filter: [{ geo_bounding_box: { centroid: { top_left: { lat: lat + dLat, lon: lng - dLng }, bottom_right: { lat: lat - dLat, lon: lng + dLng } } } }],
          should: [
            { term: { "status.raw": "Commenced" } },
            { range: { valid_date: { gte: ukDate(since), format: "dd/MM/yyyy" } } },
          ],
          minimum_should_match: 1,
        },
      },
    }
    const result = await fetchUpstream(SEARCH_URL, 6 * 60 * 60 * 1000, {
      timeoutMs: 15_000,
      method: "POST",
      cacheKey: `https://smartldn-cache.invalid/planning/${encodeURIComponent(viewCacheKey(lng, lat, zoom))}`,
      body: JSON.stringify(query),
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    })
    if (result.status !== 200) throw new Error(`HTTP ${result.status} from Planning London Datahub`)
    return { ok: true, apps: parsePlanningHits(JSON.parse(new TextDecoder().decode(result.body))) }
  },
  missing: () => ({ ok: false, error: "Planning centre missing", apps: [] }),
  failed: (error) => ({ ok: false, error: errorText(error, "Planning applications failed"), apps: [] }),
})

function ukDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0")
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  return `${day}/${month}/${date.getUTCFullYear()}`
}
