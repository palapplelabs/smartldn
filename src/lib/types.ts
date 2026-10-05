// TfL publishes a status for each road corridor, not a speed. The band keeps the
// three map colours: Good is free, Serious is slow, Severe or Closure is congested.
export type SpeedBand = "free" | "slow" | "congested" | "unknown"

export type Corridor = {
  id: string
  name: string
  status: string
  detail: string
  band: SpeedBand
  closed: boolean
  paths: [number, number][][]
}

export type CorridorSummary = {
  free: number
  slow: number
  congested: number
  unknown: number
}

export type RoadsResponse = {
  ok: boolean
  error?: string
  observedAt: string | null
  corridors: Corridor[]
  summary: CorridorSummary
}

export type DisruptionsResponse = {
  ok: boolean
  error?: string
  observedAt: string | null
  works: GeoJSON.FeatureCollection
  incidents: GeoJSON.FeatureCollection
}

export type CamerasResponse = {
  ok: boolean
  error?: string
  cameras: GeoJSON.FeatureCollection
}

export type CrossingTone = "red" | "amber" | "green" | "none"

export type ThamesCrossing = {
  id: string
  name: string
  short: string
  status: string
  detail: string
  tone: CrossingTone
  coordinates: [number, number]
}

export type WeatherWarning = {
  id: string
  coordinates?: [number, number] | null
  kind: "weather" | "flood"
  name: string
  shortName: string
  detail: string
  tone: "red" | "amber"
  urgent: boolean
  score: number
}

export type WeatherConditions = {
  temperatureC: number | null
  rainfallMm: number | null
  rainfallPlace: string
}

export type WarningsResponse = {
  ok: boolean
  error?: string
  observedAt: string | null
  warnings: WeatherWarning[]
  conditions: WeatherConditions
  // Met Office warning areas that reach Greater London, when the NSWWS key is set.
  areas: GeoJSON.FeatureCollection
}

export type TimeType = "A" | "D"

export type RailTrain = {
  id: string
  line: string
  dest: string
  plat: string
  ttnt: number
  observedAt: string
  delay: boolean
  timeType: TimeType
  anchor: string
  path: string[]
  hold: string[]
}

export type RailCalling = {
  dest: string
  destName: string
  plat: string
  ttnt: number
  delay: boolean
  timeType: TimeType
}

export type RailBoard = {
  line: string
  station: string
  message: string
  trains: RailCalling[]
}

export type RailResponse = {
  ok: boolean
  error?: string
  observedAt: string | null
  trains: RailTrain[]
  boards: RailBoard[]
}

export type LineTone = "red" | "amber" | "green"

export type LineStatus = {
  id: string
  name: string
  mode: string
  color: string
  severity: number
  status: string
  reason: string
  tone: LineTone
}

export type LiftOutage = {
  station: string
  message: string
}

export type StatusResponse = {
  ok: boolean
  error?: string
  observedAt: string | null
  lines: LineStatus[]
  lifts: LiftOutage[]
}

export type ArrivalClock = "ready" | "waiting"

export type BusCall = {
  route: string
  dest: string
  eta: string
  minutes: number | null
  vehicle: string
}

export type BusStopBoard = {
  id: string
  name: string
  indicator: string
  lng: number
  lat: number
  routes: string[]
  calls: BusCall[]
  clock: ArrivalClock
}

export type BusPlacesResponse = {
  ok: boolean
  error?: string
  stops: Omit<BusStopBoard, "calls" | "clock">[]
}

export type BusResponse = {
  ok: boolean
  error?: string
  observedAt: string | null
  stops: BusStopBoard[]
}

export type BusVehicle = {
  id: string
  route: string
  dest: string
  operator: string
  lng: number
  lat: number
  bearing: number | null
  at: number
}

export type BusVehiclesResponse = {
  ok: boolean
  error?: string
  observedAt: string | null
  vehicles: BusVehicle[]
}

export type CycleDock = {
  id: string
  name: string
  lng: number
  lat: number
  bikes: number
  ebikes: number
  empty: number
  docks: number
}

export type CyclesResponse = {
  ok: boolean
  error?: string
  observedAt: string | null
  docks: CycleDock[]
}

export type AirSite = {
  code: string
  name: string
  lng: number
  lat: number
  index: number | null
  band: string
  species: string
}

export type AirResponse = {
  ok: boolean
  error?: string
  observedAt: string | null
  sites: AirSite[]
}

export type PlanningStage = "building" | "pending" | "decided"

export type PlanningApp = {
  id: string
  authority: string
  status: string
  stage: PlanningStage
  description: string
  site: string
  validDate: string
  commencedDate: string
  lng: number
  lat: number
}

export type PlanningResponse = {
  ok: boolean
  error?: string
  apps: PlanningApp[]
}

export type WatchLayer =
  | "roads"
  | "cameras"
  | "works"
  | "incidents"
  | "charges"
  | "rail"
  | "light"
  | "bus"
  | "river"
  | "cycles"
  | "planning"
  | "air"

export type WatchLayers = Record<WatchLayer, boolean>

export type Basemap = "satellite" | "street" | "buildings"
