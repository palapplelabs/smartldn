import { parseLaqn } from "@/lib/city-feeds"
import { errorText, snapshotGet } from "@/lib/snapshot-route"
import { fetchUpstream } from "@/lib/upstream"
import type { AirResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

const LAQN_URL = "https://api.erg.ic.ac.uk/AirQuality/Hourly/MonitoringIndex/GroupName=London/Json"

export const GET = snapshotGet<AirResponse>({
  freshMs: 15 * 60_000,
  async load(now) {
    const result = await fetchUpstream(LAQN_URL, 15 * 60_000, { timeoutMs: 20_000 })
    if (result.status !== 200) throw new Error(`HTTP ${result.status} from London Air`)
    const sites = parseLaqn(JSON.parse(new TextDecoder().decode(result.body)))
    return { ok: true, observedAt: new Date(now).toISOString(), sites }
  },
  failed: (error) => ({ ok: false, error: errorText(error, "Air quality failed"), observedAt: null, sites: [] }),
})
