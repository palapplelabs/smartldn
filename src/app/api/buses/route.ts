import { parseSiriVm, vehiclesWithin } from "@/lib/bus-positions"
import { errorText } from "@/lib/snapshot-route"
import { fetchUpstream } from "@/lib/upstream"
import { inLondon } from "@/lib/view-reach"
import type { BusVehicle, BusVehiclesResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

const FEED = "https://data.bus-data.dft.gov.uk/api/v1/datafeed/"
// Greater London with a margin; the feed is filtered to it upstream.
const LONDON_BOX = "-0.56,51.26,0.35,51.71"
const FRESH_MS = 20_000
// A wide view of central London holds well under this.
const VIEW_CAP = 2_500

let cached: { at: number; vehicles: BusVehicle[] } | null = null
let pending: Promise<BusVehicle[]> | null = null

// One parse of the whole London feed per refresh; each view takes its slice.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const box = ["w", "s", "e", "n"].map((key) => Number(params.get(key))) as [number, number, number, number]
  const [west, south, east, north] = box
  if (box.some((value) => !Number.isFinite(value)) || west >= east || south >= north) {
    return Response.json(empty("Bus view missing"), { status: 400 })
  }
  if (!inLondon((west + east) / 2, (south + north) / 2)) return Response.json({ ...empty(), ok: true })
  const key = process.env.BODS_API_KEY
  if (!key) return Response.json(empty("BODS_API_KEY is not set"), { status: 503 })
  try {
    const vehicles = await snapshot(key)
    return Response.json({
      ok: true,
      observedAt: cached ? new Date(cached.at).toISOString() : null,
      vehicles: vehiclesWithin(vehicles, box, VIEW_CAP),
    } satisfies BusVehiclesResponse)
  } catch (error) {
    if (cached) return Response.json({ ok: true, observedAt: new Date(cached.at).toISOString(), vehicles: vehiclesWithin(cached.vehicles, box, VIEW_CAP) })
    return Response.json(empty(errorText(error, "Bus positions failed")), { status: 502 })
  }
}

async function snapshot(key: string): Promise<BusVehicle[]> {
  const now = Date.now()
  if (cached && now - cached.at < FRESH_MS) return cached.vehicles
  pending ??= load(key).finally(() => {
    pending = null
  })
  return pending
}

async function load(key: string): Promise<BusVehicle[]> {
  const url = `${FEED}?boundingBox=${LONDON_BOX}&api_key=${encodeURIComponent(key)}`
  const result = await fetchUpstream(url, FRESH_MS, {
    timeoutMs: 20_000,
    // The key stays out of the shared cache key.
    // An Accept header for XML gets a 406 from this feed, so none is sent.
    cacheKey: "https://smartldn-cache.invalid/bods/london",
  })
  if (result.status !== 200) throw new Error(`HTTP ${result.status} from Bus Open Data Service`)
  const now = Date.now()
  const vehicles = parseSiriVm(new TextDecoder().decode(result.body), now)
  cached = { at: now, vehicles }
  return vehicles
}

function empty(error?: string): BusVehiclesResponse {
  return { ok: false, error, observedAt: null, vehicles: [] }
}
