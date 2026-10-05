import { loadBusPlaces } from "@/lib/bus-feed"
import { errorText } from "@/lib/snapshot-route"
import { viewCachedGet } from "@/lib/view-cache"
import { viewCacheKey } from "@/lib/view-reach"
import type { BusPlacesResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

const empty = (error: string): BusPlacesResponse => ({ ok: false, error, stops: [] })

export const GET = viewCachedGet<BusPlacesResponse>({
  freshMs: 12 * 60 * 60 * 1000,
  load: (lng, lat, _now, zoom) => loadBusPlaces(lng, lat, zoom),
  cacheKey: viewCacheKey,
  missing: () => empty("Bus stop centre missing"),
  failed: (error) => empty(errorText(error, "Bus stops failed")),
})
