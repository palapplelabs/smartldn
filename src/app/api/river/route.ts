import { loadRailSnapshot } from "@/lib/rail-feed"
import { errorText, snapshotGet } from "@/lib/snapshot-route"
import type { RailResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

export const GET = snapshotGet<RailResponse>({
  freshMs: 15_000,
  load: (now) => loadRailSnapshot("river", now),
  failed: (error) => ({ ok: false, error: errorText(error, "Arrivals failed"), observedAt: null, trains: [], boards: [] }),
})
