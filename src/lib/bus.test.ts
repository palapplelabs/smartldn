import assert from "node:assert/strict"
import { GLIDE_MS, busMotionCollection, busPosition, noBusMotion, syncBusMotion } from "./bus-motion.ts"
import { parseSiriVm, vehiclesWithin } from "./bus-positions.ts"
import type { BusVehicle } from "./types.ts"

const now = Date.parse("2026-10-05T10:50:46Z")

function activity(fields: Record<string, string>): string {
  const journey = Object.entries(fields)
    .filter(([key]) => key !== "RecordedAtTime" && key !== "Longitude" && key !== "Latitude")
    .map(([key, value]) => `<${key}>${value}</${key}>`)
    .join("")
  return `<VehicleActivity><RecordedAtTime>${fields.RecordedAtTime}</RecordedAtTime><MonitoredVehicleJourney>${journey}<VehicleLocation><Longitude>${fields.Longitude}</Longitude><Latitude>${fields.Latitude}</Latitude></VehicleLocation></MonitoredVehicleJourney></VehicleActivity>`
}

// --- SIRI-VM parsing, shaped like the live BODS feed ---
const xml = `<Siri><ServiceDelivery><VehicleMonitoringDelivery>
${activity({ RecordedAtTime: "2026-10-05T10:50:31+00:00", LineRef: "410", PublishedLineName: "297", OperatorRef: "TFLO", OriginName: "Ealing Broadway Stn / Haven Green", OriginAimedDepartureTime: "2026-10-05T10:40:00+00:00", DestinationName: "Perivale", Longitude: "-0.303592", Latitude: "51.515384", Bearing: "315", VehicleRef: "LV23DJJ" })}
${activity({ RecordedAtTime: "2026-10-05T10:50:40+00:00", LineRef: "700", PublishedLineName: "700", OperatorRef: "AKSS", DestinationName: "Waterfront_Bus_Station", Longitude: "0.276403", Latitude: "51.437713", VehicleRef: "YX1" })}
${activity({ RecordedAtTime: "2026-10-05T09:03:15+00:00", PublishedLineName: "28", OperatorRef: "TFLO", Longitude: "-0.19", Latitude: "51.46", VehicleRef: "OLD" })}
${activity({ RecordedAtTime: "2026-10-05T10:50:31+00:00", PublishedLineName: "297", OperatorRef: "TFLO", Longitude: "-0.3", Latitude: "51.5", VehicleRef: "LV23DJJ" })}
${activity({ RecordedAtTime: "2026-10-05T10:50:31+00:00", PublishedLineName: "N29", OperatorRef: "TFLO", Longitude: "0", Latitude: "0", VehicleRef: "NOWHERE" })}
</VehicleMonitoringDelivery></ServiceDelivery></Siri>`
const vehicles = parseSiriVm(xml, now)
assert.equal(vehicles.length, 2)
assert.deepEqual(vehicles[0], { id: "TFLO:LV23DJJ", route: "297", dest: "Perivale", operator: "TFLO", lng: -0.30359, lat: 51.51538, bearing: 315, at: Date.parse("2026-10-05T10:50:31Z"), origin: "Ealing Broadway Stn / Haven Green", departed: "2026-10-05T10:40:00+00:00" })
assert.equal(vehicles[1]?.dest, "Waterfront Bus Station")
assert.equal(vehicles[1]?.bearing, null)
assert.deepEqual(vehiclesWithin(vehicles, [-0.4, 51.4, 0, 51.6], 10).map((item) => item.id), ["TFLO:LV23DJJ"])
assert.equal(vehiclesWithin(vehicles, [-1, 51, 1, 52], 1).length, 1)

// --- Gliding between reports ---
const bus = (lng: number, at: number): BusVehicle => ({ id: "TFLO:A", route: "24", dest: "Hampstead Heath", operator: "TFLO", lng, lat: 51.5, bearing: null, at, origin: "", departed: "" })
const first = syncBusMotion(noBusMotion(), [bus(-0.13, 1)], 0)
assert.deepEqual(busPosition(first.get("TFLO:A")!, 5_000), [-0.13, 51.5])
const second = syncBusMotion(first, [bus(-0.128, 2)], 1_000)
const halfway = busPosition(second.get("TFLO:A")!, 1_000 + GLIDE_MS / 2)
assert.ok(Math.abs(halfway[0] - -0.129) < 1e-9)
assert.deepEqual(busPosition(second.get("TFLO:A")!, 1_000 + GLIDE_MS * 2), [-0.128, 51.5])
// The same report again keeps the glide going instead of restarting it.
const repeat = syncBusMotion(second, [bus(-0.128, 2)], 5_000)
assert.equal(repeat.get("TFLO:A")?.start, 1_000)
// A jump of several kilometres snaps rather than sliding across the city.
const jump = syncBusMotion(second, [bus(-0.05, 3)], 2_000)
assert.deepEqual(busPosition(jump.get("TFLO:A")!, 2_000), [-0.05, 51.5])
// A bus that stops reporting leaves the map.
assert.equal(syncBusMotion(second, [], 3_000).size, 0)
assert.equal(busMotionCollection(second, 1_000).features[0]?.properties?.route, "24")

assert.equal(vehicles[1]?.origin, "")

console.log("bus ok")
