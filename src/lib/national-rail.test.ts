import assert from "node:assert/strict"
import { departureState, isCrs, parseBoard, parseCallingPoints, parseStations, plainText } from "./national-rail.ts"

const london = (lng: number, lat: number) => lng > -0.6 && lng < 0.4 && lat > 51.2 && lat < 51.8

// Shaped like the Knowledgebase Stations (JSON) feed.
const stations = parseStations(
  {
    stations: [
      {
        name: "Abbey Wood",
        crsCode: "ABW",
        location: { latitude: 51.49077059, longitude: 0.12032557 },
        stationOperator: { name: "Elizabeth line" },
        stationAccessibility: { stepFreeCategory: { category: "A, Compliant step-free access to all platform(s)" } },
        stationAlerts: [{ alertText: "<p>The lifts are out of order between platform 1 &amp; 2.</p><p></p>" }],
      },
      { name: "Edinburgh", crsCode: "EDB", location: { latitude: 55.95, longitude: -3.19 } },
      { name: "No code", crsCode: "", location: { latitude: 51.5, longitude: -0.1 } },
      { name: "No place", crsCode: "XYZ" },
    ],
  },
  london,
)
assert.deepEqual(stations, [
  { crs: "ABW", name: "Abbey Wood", lng: 0.12033, lat: 51.49077, operator: "Elizabeth line", stepFree: "A", alerts: ["The lifts are out of order between platform 1 & 2."] },
])
assert.deepEqual(parseStations(null, london), [])

// Shaped like Darwin GetDepartureBoard.
const board = parseBoard({
  crs: "CLJ",
  locationName: "Clapham Junction",
  generatedAt: "2026-10-26T23:20:00",
  nrccMessages: [{ Value: "The lifts between platforms 11 and 12 are out of order." }],
  trainServices: [
    { serviceID: "A1", std: "23:21", etd: "23:38", platform: "7", operator: "South Western Railway", isCancelled: false, delayReason: "A signal fault", length: 5, destination: [{ locationName: "Woking" }] },
    { serviceID: "A2", std: "23:25", etd: "Cancelled", platform: "", operator: "Southern", isCancelled: true, cancelReason: "A shortage of train crew", length: 0, destination: [{ locationName: "Brighton" }, { locationName: "Littlehampton" }] },
    { std: "23:30" },
  ],
})
assert.equal(board?.name, "Clapham Junction")
assert.deepEqual(board?.notices, ["The lifts between platforms 11 and 12 are out of order."])
assert.equal(board?.departures.length, 2)
assert.deepEqual(board?.departures[1], { id: "A2", scheduled: "23:25", expected: "Cancelled", destination: "Brighton & Littlehampton", platform: "", operator: "Southern", cancelled: true, reason: "A shortage of train crew", coaches: null })
assert.equal(board?.departures[0]?.coaches, 5)
assert.equal(parseBoard({ crs: "nope" }), null)

const calls = parseCallingPoints({
  subsequentCallingPoints: [{ callingPoint: [{ locationName: "Norwood Junction", crs: "NWD", st: "23:42", et: "23:53", isCancelled: false }, { locationName: "", st: "23:50" }] }],
})
assert.deepEqual(calls, [{ name: "Norwood Junction", crs: "NWD", scheduled: "23:42", expected: "23:53", cancelled: false }])
assert.deepEqual(parseCallingPoints({}), [])

assert.deepEqual(departureState({ scheduled: "23:40", expected: "On time", cancelled: false }), { label: "On time", tone: "green" })
assert.deepEqual(departureState({ scheduled: "23:21", expected: "23:38", cancelled: false }), { label: "Exp 23:38", tone: "amber" })
assert.deepEqual(departureState({ scheduled: "23:32", expected: "Delayed", cancelled: false }), { label: "Delayed", tone: "amber" })
assert.deepEqual(departureState({ scheduled: "23:25", expected: "Cancelled", cancelled: true }), { label: "Cancelled", tone: "red" })

assert.equal(isCrs("LBG"), true)
assert.equal(isCrs("lbg"), false)
assert.equal(plainText("<p>Go to the <a href='x'>website</a>&nbsp;now</p>"), "Go to the website now")

console.log("national rail ok")
