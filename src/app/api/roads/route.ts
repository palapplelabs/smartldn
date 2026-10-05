import shapes from "../../../../data/road-corridors.json"
import { corridorsFromStatus, summarize, type CorridorShapes } from "@/lib/road-status"
import { errorText, snapshotGet } from "@/lib/snapshot-route"
import { records, tflJson } from "@/lib/tfl"
import type { RoadsResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

const EMPTY_SUMMARY = { free: 0, slow: 0, congested: 0, unknown: 0 }

export const GET = snapshotGet<RoadsResponse>({
  freshMs: 60_000,
  async load(now) {
    const rows = records(await tflJson("/Road", 60_000))
    const corridors = corridorsFromStatus(rows, shapes as unknown as CorridorShapes)
    return { ok: true, observedAt: new Date(now).toISOString(), corridors, summary: summarize(corridors) }
  },
  failed: (error) => ({ ok: false, error: errorText(error, "Road status failed"), observedAt: null, corridors: [], summary: EMPTY_SUMMARY }),
})
