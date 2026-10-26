import { isCrs, parseBoard, parseCallingPoints, parseStations } from "@/lib/national-rail"
import { fetchUpstream } from "@/lib/upstream"
import { inLondon } from "@/lib/view-reach"
import type { NationalBoard, NationalCall, NationalStation } from "@/lib/types"

// Rail Data Marketplace products, one key each (RDM_*_KEY, sent as x-apikey).
const STATIONS_URL = "https://api1.raildata.org.uk/1010-nationalrail-knowledgebase-stations-feed-_json_---production5_0/stations"
const BOARD_URL = "https://api1.raildata.org.uk/1010-live-departure-board-dep1_2/LDBWS/api/20220120/GetDepartureBoard"
const SERVICE_URL = "https://api1.raildata.org.uk/1010-service-details1_2/LDBWS/api/20220120/GetServiceDetails"

const STATIONS_MS = 24 * 60 * 60_000
const BOARD_MS = 30_000
const BOARD_ROWS = 12
const SERVICE_ID = /^[A-Za-z0-9_]{6,40}$/

export class MissingKey extends Error {}

function key(name: "RDM_STATIONS_KEY" | "RDM_LDB_KEY" | "RDM_SERVICE_KEY"): string {
  const value = process.env[name]
  if (!value) throw new MissingKey(`${name} is not set`)
  return value
}

// The station feed covers Great Britain and runs to tens of megabytes, so it is
// read once a day straight into London's few hundred stations, not through the
// shared response cache.
type StationIndex = { at: number; list: NationalStation[]; byCrs: Map<string, NationalStation> }

let stations: StationIndex | null = null
let loading: Promise<StationIndex> | null = null

export async function londonStations(): Promise<NationalStation[]> {
  return (await stationIndex()).list
}

async function stationIndex(): Promise<StationIndex> {
  if (stations && Date.now() - stations.at < STATIONS_MS) return stations
  loading ??= (async () => {
    const response = await fetch(STATIONS_URL, { headers: { "x-apikey": key("RDM_STATIONS_KEY") }, cache: "no-store", signal: AbortSignal.timeout(90_000) })
    if (!response.ok) throw new Error(`National Rail stations ${response.status}`)
    const list = parseStations(await response.json(), inLondon).sort((a, b) => a.name.localeCompare(b.name))
    if (list.length === 0) throw new Error("National Rail stations empty")
    const index: StationIndex = { at: Date.now(), list, byCrs: new Map(list.map((station) => [station.crs, station])) }
    stations = index
    return index
  })().finally(() => {
    loading = null
  })
  try {
    return await loading
  } catch (error) {
    // A failed refresh keeps yesterday's list rather than emptying the map.
    if (stations) return stations
    throw error
  }
}

// Only London stations are looked up, so a stray request cannot spend the
// key's allowance on the rest of the country.
export async function departureBoard(crs: string): Promise<NationalBoard | null> {
  if (!isCrs(crs) || !(await stationIndex()).byCrs.has(crs)) return null
  const upstream = await fetchUpstream(`${BOARD_URL}/${crs}?numRows=${BOARD_ROWS}`, BOARD_MS, { headers: { "x-apikey": key("RDM_LDB_KEY") }, timeoutMs: 12_000 })
  if (upstream.status !== 200) throw new Error(`Departure board ${upstream.status}`)
  return parseBoard(JSON.parse(new TextDecoder().decode(upstream.body)))
}

export async function callingPoints(id: string): Promise<NationalCall[] | null> {
  if (!SERVICE_ID.test(id)) return null
  const upstream = await fetchUpstream(`${SERVICE_URL}/${encodeURIComponent(id)}`, BOARD_MS, { headers: { "x-apikey": key("RDM_SERVICE_KEY") }, timeoutMs: 12_000 })
  if (upstream.status !== 200) throw new Error(`Service details ${upstream.status}`)
  return parseCallingPoints(JSON.parse(new TextDecoder().decode(upstream.body)))
}
