import networkFile from "../../data/london-rail.json"
import { projectTrain, type EstimateRoute, type GeoPoint, type TrainSpot } from "@/lib/train-estimate"
import type { RailTrain } from "@/lib/types"

// Built by scripts/build-london-data.mjs from TfL route sequences.
export type RailMode = "rail" | "light" | "river"

type StationRecord = { name: string; lng: number; lat: number }
type LineRecord = { name: string; color: string; mode: RailMode }
type NetworkFile = {
  stations: Record<string, StationRecord>
  lines: Record<string, LineRecord>
  routes: EstimateRoute[]
  tracks: Record<string, [number, number][][]>
}

const network = networkFile as unknown as NetworkFile

const linesThroughStation = new Map<string, string[]>()
const stationsByName = new Map<string, string>()
for (const route of network.routes) {
  for (const code of route.stations) {
    const lines = linesThroughStation.get(code) ?? []
    if (!lines.includes(route.line)) lines.push(route.line)
    linesThroughStation.set(code, lines)
    const station = network.stations[code]
    if (station) stationsByName.set(`${route.line}|${nameKey(station.name)}`, code)
  }
}

function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/ (underground|rail|dlr|tram) station$/, "")
    .replace(/ \(london\)/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function linesOfMode(mode: RailMode): string[] {
  return Object.entries(network.lines)
    .filter(([, line]) => line.mode === mode)
    .map(([id]) => id)
}

export function modeOfLine(line: string): RailMode | null {
  return network.lines[line]?.mode ?? null
}

export function networkRoutes(mode: RailMode): EstimateRoute[] {
  return network.routes.filter((route) => network.lines[route.line]?.mode === mode)
}

export function stationRecord(code: string): StationRecord | null {
  return network.stations[code] ?? null
}

// A few Elizabeth line calls use the shared National Rail code for a station
// (Farringdon, Abbey Wood). The name on the call finds the line's own code.
export function resolveStation(line: string, code: string, name: string): string | null {
  if (network.stations[code]) return code
  return stationsByName.get(`${line}|${nameKey(name)}`) ?? null
}

export function lineRecord(code: string): LineRecord | null {
  return network.lines[code] ?? null
}

export function linesThrough(station: string, mode?: RailMode): string[] {
  const lines = linesThroughStation.get(station) ?? []
  return mode ? lines.filter((line) => network.lines[line]?.mode === mode) : lines
}

export function stationPoint(code: string): GeoPoint | null {
  const station = network.stations[code]
  if (!station) return null
  return { lng: station.lng, lat: station.lat }
}

export function projectNetworkTrain(train: RailTrain, atMs: number): TrainSpot | null {
  const observedAt = Date.parse(train.observedAt)
  if (!Number.isFinite(observedAt)) return null
  return projectTrain({ ...train, observedAt }, stationPoint, atMs)
}

export function trackCollection(mode: RailMode): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const [line, meta] of Object.entries(network.lines)) {
    if (meta.mode !== mode) continue
    const paths = network.tracks[line] ?? []
    if (paths.length === 0) continue
    features.push({
      type: "Feature",
      properties: { line, color: meta.color },
      geometry: { type: "MultiLineString", coordinates: paths },
    })
  }
  return { type: "FeatureCollection", features }
}

export function stationCollection(mode: RailMode): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const [code, station] of Object.entries(network.stations)) {
    if (linesThrough(code, mode).length === 0) continue
    features.push({
      type: "Feature",
      properties: { code, name: station.name, mode },
      geometry: { type: "Point", coordinates: [station.lng, station.lat] },
    })
  }
  return { type: "FeatureCollection", features }
}
