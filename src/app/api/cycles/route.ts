import { parseBikePoints } from "@/lib/city-feeds"
import { errorText, snapshotGet } from "@/lib/snapshot-route"
import { records, tflJson } from "@/lib/tfl"
import type { CyclesResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

export const GET = snapshotGet<CyclesResponse>({
  freshMs: 2 * 60_000,
  async load(now) {
    const docks = parseBikePoints(records(await tflJson("/BikePoint", 2 * 60_000)))
    return { ok: true, observedAt: new Date(now).toISOString(), docks }
  },
  failed: (error) => ({ ok: false, error: errorText(error, "Cycle docks failed"), observedAt: null, docks: [] }),
})
