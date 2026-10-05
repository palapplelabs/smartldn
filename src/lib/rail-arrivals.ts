import type { TrainObservation } from "./train-estimate.ts"
import type { RailBoard, RailCalling } from "./types.ts"

// Elizabeth line and Overground boards run more than an hour ahead. Calls beyond
// half an hour do not move a dot and only weigh the response down.
const HORIZON_SEC = 30 * 60
const BOARD_CALLS = 6

export type StationLookup = {
  resolve: (line: string, code: string, name: string) => string | null
  nameOf: (code: string) => string | null
}

// TfL arrival predictions → per-station boards, and observations for the train estimator.
export function readArrivals(rows: Record<string, unknown>[], now: number, lookup: StationLookup): { observations: TrainObservation[]; boards: RailBoard[] } {
  const observations: TrainObservation[] = []
  const boards = new Map<string, RailBoard>()
  for (const row of rows) {
    const line = str(row, "lineId")
    const seconds = typeof row.timeToStation === "number" ? row.timeToStation : NaN
    if (!line || !Number.isFinite(seconds) || seconds < 0 || seconds > HORIZON_SEC) continue
    const station = lookup.resolve(line, str(row, "naptanId"), str(row, "stationName"))
    if (!station) continue
    const destName = tidyName(str(row, "destinationName") || str(row, "towards"))
    const dest = lookup.resolve(line, str(row, "destinationNaptanId"), str(row, "destinationName")) ?? ""
    const stamp = Date.parse(str(row, "timestamp"))
    const observedAt = Number.isFinite(stamp) && stamp <= now + 60_000 ? stamp : now
    const ttnt = Math.round((seconds / 60) * 10) / 10
    const plat = tidyPlatform(str(row, "platformName"))
    const key = `${line}|${station}`
    const board = boards.get(key) ?? { line, station, message: "", trains: [] }
    board.trains.push({ dest, destName: dest ? lookup.nameOf(dest) ?? destName : destName, plat, ttnt, delay: false, timeType: "A" })
    boards.set(key, board)
    if (!dest) continue
    observations.push({
      line,
      station,
      dest,
      plat,
      ttnt,
      dueAt: observedAt + seconds * 1000,
      observedAt,
      delay: false,
      timeType: "A",
      vehicle: str(row, "vehicleId") || undefined,
    })
  }
  for (const board of boards.values()) {
    board.trains = soonest(board.trains)
  }
  return { observations, boards: [...boards.values()] }
}

function soonest(calls: RailCalling[]): RailCalling[] {
  return calls.sort((a, b) => a.ttnt - b.ttnt).slice(0, BOARD_CALLS)
}

function tidyPlatform(value: string): string {
  // "Northbound - Platform 1" → "Northbound · 1"; "Platform 4" → "4"
  const match = value.match(/^(.*?)\s*-?\s*Platform\s+(\w+)$/i)
  if (!match) return value === "null" ? "" : value
  const side = match[1]?.trim() ?? ""
  return side ? `${side} · ${match[2]}` : match[2] ?? ""
}

function tidyName(value: string): string {
  return value
    .replace(/ (Underground|Rail|DLR) Station$/i, "")
    .replace(/ Tram Stop$/i, "")
    .replace(/ \(London\)$/i, "")
    .trim()
}

function str(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  return typeof value === "string" ? value.trim() : ""
}
