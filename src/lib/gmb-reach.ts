import networkFile from "../../data/gmb-network.json" with { type: "json" }
import { pointsWithin } from "@/lib/nearest"
import { indexPoints, mates } from "@/lib/point-index"

type StopRecord = {
  tc: string
  en: string
  lng: number
  lat: number
  routes: string[]
  ids: Record<string, string>
}

type NetworkFile = { stops: Record<string, StopRecord> }

export type GmbStopPoint = { id: string; lng: number; lat: number; routes: string[] }

const network = networkFile as NetworkFile
const stopList: GmbStopPoint[] = []
for (const [id, stop] of Object.entries(network.stops)) {
  if (!Number.isFinite(stop.lng) || !Number.isFinite(stop.lat)) continue
  stopList.push({ id, lng: stop.lng, lat: stop.lat, routes: stop.routes ?? [] })
}

const pointIndex = indexPoints(stopList)

export function gmbStop(id: string): StopRecord | null {
  return network.stops[id] ?? null
}

export function gmbPoleIds(id: string): string[] {
  const stop = network.stops[id]
  if (!stop) return []
  return mates(pointIndex, id, stop.lng, stop.lat)
}

export function gmbStopsWithin(lng: number, lat: number, radiusMetres: number, limit: number): GmbStopPoint[] {
  return pointsWithin(stopList, lng, lat, radiusMetres, limit)
}
