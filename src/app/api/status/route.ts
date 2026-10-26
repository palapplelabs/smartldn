import { parseLifts, parseLineStatus } from "@/lib/line-status"
import { LONDON_OPERATORS } from "@/lib/national-rail"
import { lineRecord, stationRecord } from "@/lib/rail-network"
import { errorText, snapshotGet } from "@/lib/snapshot-route"
import { records, tflJson } from "@/lib/tfl"
import type { StatusResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

const MODES = "tube,dlr,elizabeth-line,overground,tram,cable-car,river-bus,national-rail"

export const GET = snapshotGet<StatusResponse>({
  freshMs: 60_000,
  async load(now) {
    const [statusRows, liftRows] = await Promise.all([
      tflJson(`/Line/Mode/${MODES}/Status`, 60_000),
      tflJson("/Disruptions/Lifts/v2/", 5 * 60_000).catch(() => []),
    ])
    // TfL lists every train operator in Britain; keep the ones that serve London.
    const rows = records(statusRows).filter((row) => row.modeName !== "national-rail" || (typeof row.id === "string" && row.id in LONDON_OPERATORS))
    const lines = parseLineStatus(rows, (id) => lineRecord(id)?.color ?? LONDON_OPERATORS[id] ?? "#7DD3E8")
    const lifts = parseLifts(records(liftRows), (code) => stationRecord(code)?.name ?? null)
    return { ok: true, observedAt: new Date(now).toISOString(), lines, lifts }
  },
  failed: (error) => ({ ok: false, error: errorText(error, "Line status failed"), observedAt: null, lines: [], lifts: [] }),
})
