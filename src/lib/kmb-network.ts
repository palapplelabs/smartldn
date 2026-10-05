import networkFile from "../../data/kmb-network.json"
import { pointsWithin } from "@/lib/nearest"
import { indexPoints, mates } from "@/lib/point-index"
import { catalogueAccepts } from "@/lib/stop-list"

type StopRecord = { tc: string; en: string; lng: number; lat: number }
type NetworkFile = { stops: Record<string, StopRecord> }

export type KmbStopPoint = { id: string; lng: number; lat: number }

const network = networkFile as NetworkFile

const stopList: KmbStopPoint[] = []
for (const [id, stop] of Object.entries(network.stops)) {
  stopList.push({ id, lng: stop.lng, lat: stop.lat })
}
const bundledCount = stopList.length
let records: Record<string, StopRecord> = network.stops
let pointIndex = indexPoints(stopList)

export function kmbBundledStopCount(): number {
  return bundledCount
}

export function replaceKmbCatalogue(stops: Record<string, StopRecord>): boolean {
  const entries = Object.entries(stops)
  if (!catalogueAccepts(entries.length, bundledCount)) return false
  const nextRecords: Record<string, StopRecord> = {}
  const nextPoints: KmbStopPoint[] = []
  for (const [id, stop] of entries) {
    nextRecords[id] = { tc: stop.tc, en: stop.en, lng: stop.lng, lat: stop.lat }
    nextPoints.push({ id, lng: stop.lng, lat: stop.lat })
  }
  records = nextRecords
  stopList.length = 0
  stopList.push(...nextPoints)
  pointIndex = indexPoints(stopList)
  return true
}

export function kmbStop(id: string): StopRecord | null {
  return records[id] ?? null
}

export function kmbPoleIds(id: string): string[] {
  const stop = records[id]
  if (!stop) return []
  return mates(pointIndex, id, stop.lng, stop.lat)
}

export function kmbStopsWithin(lng: number, lat: number, radiusMetres: number, limit: number): KmbStopPoint[] {
  return pointsWithin(stopList, lng, lat, radiusMetres, limit)
}
