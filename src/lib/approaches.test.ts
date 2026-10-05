import assert from "node:assert/strict"
import { readApproachPoints } from "./approaches.ts"

function board(id: string, name: string) {
  return {
    type: "Feature",
    properties: { LOCATION_ID: id, LOCATION: name },
    geometry: { type: "Point", coordinates: [114.152549, 22.327028] },
  }
}

const wfs = {
  features: [
    board("K07", "West Kowloon Highway westbound near MTR Nam Cheong Station"),
    board("H2", "Canal Road Flyover northbound"),
    board("H1", "Gloucester Road eastbound"),
  ],
}

const { points } = readApproachPoints(wfs, {
  K07: [
    { dest: { did: "ACTT", desc: "Airport via<br>Route 3", date: "2026-10-03T14:21:00", time: 21, cid: 3 } },
    { dest: { did: "ATSCA", desc: "Airport via<br>Route 8", date: "2026-10-03T14:21:00", time: 22, cid: 3 } },
  ],
  H2: [
    { dest: { did: "CH", desc: "Cross Harbour Tunnel", date: "2026-10-03T14:21:00", time: 7, cid: 3 } },
    { dest: { did: "WH", desc: "Western Harbour Crossing", date: "2026-10-03T14:21:00", time: null, cid: 0 } },
  ],
  H1: [{ dest: { did: "EH", desc: "Eastern Harbour Crossing", date: "2026-10-03T14:21:00", time: -1, cid: 1 } }],
})

assert.deepEqual(points.map((point) => point.id), ["H2"])
assert.deepEqual(points[0]?.legs.map((leg) => leg.code), ["CH"])
assert.equal(points[0]?.legs[0]?.minutes, 7)
