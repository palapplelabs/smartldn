import assert from "node:assert/strict"
import { placeTrip, tripCollection, tripFromArrivals } from "./vehicle-trip.ts"

// Shaped like TfL /Vehicle/{registration}/Arrivals for a route 9 bus.
const call = (naptanId: string, stationName: string, platformName: string, timeToStation: number) => ({
  lineId: "9", lineName: "9", naptanId, stationName, platformName, direction: "outbound", destinationName: "Hammersmith, Bus Station", timeToStation,
})
const trip = tripFromArrivals([
  call("490011760W", "Regent Street / St James's", "W", 245),
  call("490013767S", "Trafalgar Square", "S", 12),
  call("490013767S", "Trafalgar Square", "S", 14),
  call("490000173R", "Old Bond Street / Royal Academy", "null", 480),
  { stationName: "No id", timeToStation: 60 },
])
assert.ok(trip)
assert.equal(trip.line, "9")
assert.equal(trip.direction, "outbound")
assert.equal(trip.dest, "Hammersmith, Bus Station")
assert.deepEqual(trip.stops.map((stop) => [stop.name, stop.minutes, stop.indicator]), [
  ["Trafalgar Square", 0, "S"],
  ["Regent Street / St James's", 4, "W"],
  ["Old Bond Street / Royal Academy", 8, ""],
])
assert.equal(tripFromArrivals([]), null)

// Shaped like TfL /Line/9/Route/Sequence/outbound.
const placed = placeTrip(trip, {
  lineStrings: [JSON.stringify([[[-0.12764, 51.50798], [-0.13372, 51.50849], [-0.13871, 51.50935]]])],
  stopPointSequences: [{ stopPoint: [
    { id: "490013767S", name: "Trafalgar Square", lat: 51.50798, lon: -0.12764 },
    { id: "490011760W", name: "Regent Street / St James's", lat: 51.50849, lon: -0.13372 },
  ] }],
})
assert.deepEqual([placed.stops[0]?.lng, placed.stops[0]?.lat], [-0.12764, 51.50798])
assert.equal(placed.stops[2]?.lng, null)
assert.equal(placed.route.length, 1)
assert.equal(placed.route[0]?.length, 3)
assert.deepEqual(placeTrip(trip, { lineStrings: ["not json"] }).route, [])

const drawn = tripCollection(placed, 6)
assert.deepEqual(drawn.features.map((feature) => feature.properties?.kind), ["route", "stop", "stop"])
assert.equal(tripCollection(placed, 1).features.length, 2)

console.log("vehicle trip ok")
