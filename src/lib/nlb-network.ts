import networkFile from "../../data/nlb-network.json" with { type: "json" }
import { nearestMetres } from "@/lib/nearest"
import { indexPoints, mates } from "@/lib/point-index"
import { inLantau } from "./lantau.ts"

type Service = { id: string; code: string }
type StopRecord = { tc: string; en: string; lng: number; lat: number; routes: string[]; services: Service[] }
type NetworkFile = { stops: Record<string, StopRecord> }

export type NlbStopPoint = { id: string; lng: number; lat: number; routes: string[] }

const network = networkFile as NetworkFile
const stopList: NlbStopPoint[] = []
for (const [id, stop] of Object.entries(network.stops)) {
  stopList.push({ id, lng: stop.lng, lat: stop.lat, routes: stop.routes })
}

export { inLantau }

const pointIndex = indexPoints(stopList)

export function nlbStop(id: string): StopRecord | null {
  return network.stops[id] ?? null
}

export function nlbPoleIds(id: string): string[] {
  const stop = network.stops[id]
  if (!stop) return []
  return mates(pointIndex, id, stop.lng, stop.lat)
}

export function nearestNlbStops(lng: number, lat: number, limit: number): NlbStopPoint[] {
  return nearestMetres(stopList, lng, lat, limit)
}
