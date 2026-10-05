import { splitDisruptions } from "@/lib/disruptions"
import { errorText, snapshotGet } from "@/lib/snapshot-route"
import { records, tflJson } from "@/lib/tfl"
import type { DisruptionsResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }

export const GET = snapshotGet<DisruptionsResponse>({
  freshMs: 120_000,
  async load(now) {
    const rows = records(await tflJson("/Road/all/Disruption", 120_000, { stripContent: "true" }))
    return { ok: true, observedAt: new Date(now).toISOString(), ...splitDisruptions(rows) }
  },
  failed: (error) => ({ ok: false, error: errorText(error, "Road disruptions failed"), observedAt: null, works: EMPTY, incidents: EMPTY }),
})
