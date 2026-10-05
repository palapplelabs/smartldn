import { fetchText } from "@/lib/fetch-text"
import { errorText, snapshotGet } from "@/lib/snapshot-route"
import { fetchUpstream } from "@/lib/upstream"
import { EMPTY_CONDITIONS, heaviestRain, nswwsSnapshotUrl, parseFloods, parseMetOfficeRss, parseNswws, parseTemperature, rainStations } from "@/lib/warnings"
import type { WarningsResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

const WARNINGS_URL = "https://www.metoffice.gov.uk/public/data/PWSCache/WarningsRSS/Region/se"
const NSWWS_FEED = "https://data.hub.api.metoffice.gov.uk/nswws/v1.1/objects/feed"
const EMPTY_AREAS: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }
// Greater London sits inside about 25 km of Charing Cross.
const EA = "https://environment.data.gov.uk/flood-monitoring"
const FLOODS_URL = `${EA}/id/floods?lat=51.5074&long=-0.1278&dist=25`
const RAIN_STATIONS_URL = `${EA}/id/stations?parameter=rainfall&lat=51.5074&long=-0.1278&dist=25`
const RAIN_LATEST_URL = `${EA}/data/readings?parameter=rainfall&latest`
const TEMPERATURE_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=51.5074&longitude=-0.1278&current=temperature_2m&timezone=Europe%2FLondon"

export const GET = snapshotGet<WarningsResponse>({
  freshMs: 5 * 60_000,
  async load(now) {
    const [warnings, floods, stations, rain, temperature] = await Promise.allSettled([
      metOfficeWarnings(),
      readJson(FLOODS_URL, 5 * 60_000).then(parseFloods),
      readJson(RAIN_STATIONS_URL, 24 * 60 * 60_000).then(rainStations),
      readJson(RAIN_LATEST_URL, 10 * 60_000),
      readJson(TEMPERATURE_URL, 10 * 60_000).then(parseTemperature),
    ])
    const official = settled(warnings, { warnings: [], areas: EMPTY_AREAS })
    const listed = [...official.warnings, ...settled(floods, [])].sort((a, b) => b.score - a.score)
    const rainfallMm = rain.status === "fulfilled" ? heaviestRain(rain.value, settled(stations, new Set<string>()), now) : null
    const conditions = {
      ...EMPTY_CONDITIONS,
      temperatureC: settled(temperature, null),
      rainfallMm,
      rainfallPlace: rainfallMm != null && rainfallMm > 0 ? "a London gauge" : "",
    }
    const failures = [warnings, floods].filter((item) => item.status === "rejected")
    const error = failures.length === 2 ? "Weather warnings failed" : undefined
    return { ok: error == null, error, observedAt: new Date(now).toISOString(), warnings: listed, conditions, areas: official.areas }
  },
  failed: (error) => ({ ok: false, error: errorText(error, "Weather failed"), observedAt: null, warnings: [], conditions: EMPTY_CONDITIONS, areas: EMPTY_AREAS }),
})

// With a DataHub key, warnings come with their areas and only London's are kept.
// Without one, the public RSS for London & South East England is the fallback.
async function metOfficeWarnings(): Promise<{ warnings: WarningsResponse["warnings"]; areas: GeoJSON.FeatureCollection }> {
  const key = process.env.METOFFICE_NSWWS_KEY
  if (!key) return { warnings: parseMetOfficeRss(await fetchText(WARNINGS_URL, 5 * 60_000)), areas: EMPTY_AREAS }
  const headers = { apikey: key }
  // The key stays out of the shared cache key; the snapshot address names its version.
  const feed = await fetchUpstream(NSWWS_FEED, 2 * 60_000, { timeoutMs: 15_000, headers, cacheKey: "https://smartldn-cache.invalid/nswws/feed" })
  if (feed.status !== 200) throw new Error(`HTTP ${feed.status} from Met Office warnings`)
  const snapshot = nswwsSnapshotUrl(new TextDecoder().decode(feed.body))
  if (!snapshot) return { warnings: [], areas: EMPTY_AREAS }
  const issued = await fetchUpstream(snapshot, 30 * 60_000, { timeoutMs: 15_000, headers })
  if (issued.status !== 200) throw new Error(`HTTP ${issued.status} from Met Office warnings`)
  return parseNswws(JSON.parse(new TextDecoder().decode(issued.body)))
}

async function readJson(url: string, ttlMs: number): Promise<unknown> {
  const result = await fetchUpstream(url, ttlMs, { timeoutMs: 15_000, headers: { Accept: "application/json" } })
  if (result.status !== 200) throw new Error(`HTTP ${result.status} from ${new URL(url).host}`)
  return JSON.parse(new TextDecoder().decode(result.body)) as unknown
}

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback
}
