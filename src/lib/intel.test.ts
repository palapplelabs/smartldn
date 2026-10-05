import assert from "node:assert/strict"
import { MESSAGES } from "./i18n.ts"
import { intelBoard, type IntelInput } from "./intel.ts"
import type { Corridor, LineStatus } from "./types.ts"

const noFaults = {
  roads: null,
  disruptions: null,
  status: null,
  weather: null,
  cameras: null,
  rail: null,
  light: null,
  river: null,
  cycles: null,
  air: null,
  planning: null,
  map: null,
}

const quiet: IntelInput = {
  faults: noFaults,
  corridors: [],
  incidents: null,
  works: null,
  crossings: [],
  lines: [],
  lifts: [],
  warnings: [],
  warningsReady: true,
  conditions: { temperatureC: 14, rainfallMm: 0, rainfallPlace: "" },
  air: [],
}

// A quiet city ranks nothing urgent, but the weather tab still says something.
const calm = intelBoard(quiet, MESSAGES)
assert.deepEqual(calm.ranked, [])
assert.equal(calm.weather.length, 1)
assert.equal(calm.weather[0]?.title, "14°C in central London")

const corridor = (id: string, band: Corridor["band"]): Corridor => ({
  id,
  name: id.toUpperCase(),
  status: band === "congested" ? "Severe" : "Serious",
  detail: "",
  band,
  closed: false,
  paths: [[[-0.2, 51.57], [-0.19, 51.58], [-0.18, 51.59]]],
})
const line = (id: string, tone: LineStatus["tone"], severity: number, status: string): LineStatus => ({
  id,
  name: id,
  mode: "tube",
  color: "#000",
  severity,
  status,
  reason: `${id} Line: something happened.`,
  tone,
})
const point = (properties: Record<string, unknown>): GeoJSON.Feature => ({
  type: "Feature",
  properties,
  geometry: { type: "Point", coordinates: [-0.1, 51.5] },
})

const busy = intelBoard(
  {
    ...quiet,
    corridors: [corridor("a406", "congested"), corridor("a13", "slow")],
    incidents: { type: "FeatureCollection", features: [point({ id: "TIMS-1", title: "Collision", severity: "Serious", rank: 3, category: "Traffic Incidents" }), point({ id: "TIMS-2", title: "Minor", severity: "Minimal", rank: 1 })] },
    works: { type: "FeatureCollection", features: [point({ id: "TIMS-3", title: "Gas main", severity: "Moderate", rank: 2 }), point({ id: "TIMS-4", title: "Tiny", severity: "Minimal", rank: 1 })] },
    lines: [line("victoria", "red", 6, "Severe Delays"), line("tram", "amber", 9, "Minor Delays"), line("central", "green", 10, "Good Service")],
    lifts: [{ station: "Wembley Park", message: "WEMBLEY PARK STATION: lift closed." }],
    warnings: [{ id: "flood-1", kind: "flood", name: "Flood warning: River Lee", shortName: "Flood", detail: "", tone: "red", urgent: true, score: 650_000 }],
    crossings: [{ id: "blackwall", name: "Blackwall Tunnel", short: "Blackwall", status: "Closed", detail: "", tone: "red", coordinates: [0.0043, 51.5065] }],
    air: [{ code: "BG1", name: "Barking", lng: 0.17, lat: 51.56, index: 10, band: "Very High", species: "PM25" }],
  },
  MESSAGES,
)
const ids = busy.ranked.map((item) => item.id)
assert.equal(ids[0], "incident-TIMS-1")
assert.ok(ids.indexOf("line-victoria") < ids.indexOf("crossing-blackwall"))
assert.ok(ids.includes("corridor-a406"))
assert.ok(ids.includes("corridor-a13"))
assert.ok(ids.includes("works-TIMS-3"))
assert.equal(ids.includes("works-TIMS-4"), false)
assert.equal(ids.includes("incident-TIMS-2"), false)
assert.ok(ids.includes("air-BG1"))
assert.ok(ids.includes("flood-1"))
assert.equal(busy.ranked.find((item) => item.id === "line-victoria")?.detail, "something happened.")
assert.deepEqual(busy.transit.map((item) => item.id), ["line-victoria", "line-tram", "lift-Wembley Park-0"])
assert.ok(busy.roads.some((item) => item.id === "incident-TIMS-2"))
assert.equal(busy.roads.find((item) => item.id === "corridor-a406")?.coordinates?.[1], 51.58)

// A dead feed outranks everything and is listed under Systems.
const broken = intelBoard({ ...quiet, faults: { ...noFaults, roads: "HTTP 503 from TfL /Road", planning: "HTTP 500" } }, MESSAGES)
assert.equal(broken.ranked[0]?.id, "fault-roads")
assert.equal(broken.ranked[0]?.urgent, true)
assert.deepEqual(broken.systems.map((item) => item.id), ["fault-roads", "fault-planning"])
assert.equal(broken.roads[0]?.id, "fault-roads")

const boards = intelBoard({ ...quiet, boardFaults: [{ id: "490013767X", name: "Trafalgar Square" }] }, MESSAGES)
assert.equal(boards.systems[0]?.detail, "Trafalgar Square")

console.log("intel ok")
