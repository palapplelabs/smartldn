import { readArrivals } from "@/lib/rail-arrivals"
import { carryArrivalClock, estimateTrains, trainsFromVehicles, type TrainObservation } from "@/lib/train-estimate"
import { linesOfMode, networkRoutes, resolveStation, stationPoint, stationRecord, type RailMode } from "@/lib/rail-network"
import { records, tflJson } from "@/lib/tfl"
import type { RailResponse, RailTrain } from "@/lib/types"

const FRESH_MS = 15_000

let previous: Record<RailMode, TrainObservation[]> = { rail: [], light: [], river: [] }

export async function loadRailSnapshot(mode: RailMode, now = Date.now()): Promise<RailResponse> {
  const lines = linesOfMode(mode)
  if (lines.length === 0) return { ok: false, error: "No lines for this mode", observedAt: null, trains: [], boards: [] }
  const rows = records(await tflJson(`/Line/${lines.join(",")}/Arrivals`, FRESH_MS))
  const parsed = readArrivals(rows, now, { resolve: resolveStation, nameOf: (code) => stationRecord(code)?.name ?? null })
  const observations = carryArrivalClock(previous[mode], parsed.observations)
  previous = { ...previous, [mode]: observations }
  const routes = networkRoutes(mode)
  const named = observations.filter((item) => item.vehicle)
  const unnamed = observations.filter((item) => !item.vehicle)
  const estimated = [...trainsFromVehicles(routes, named, stationPoint), ...estimateTrains(routes, unnamed, stationPoint)]
  const trains = estimated.map((train): RailTrain => ({
    id: train.id,
    line: train.line,
    dest: train.dest,
    plat: train.plat,
    ttnt: train.ttnt,
    observedAt: new Date(train.observedAt).toISOString(),
    delay: train.delay,
    timeType: train.timeType,
    anchor: train.anchor,
    path: train.path,
    hold: train.hold,
  }))
  return { ok: true, observedAt: new Date(now).toISOString(), trains, boards: parsed.boards }
}
