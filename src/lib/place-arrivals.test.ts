import assert from "node:assert/strict"
import { catalogueBoards } from "./place-arrivals.ts"

const places = {
  ok: true,
  stops: [
    { id: "490013767X", name: "Northumberland Avenue / Trafalgar Square", indicator: "X", lng: -0.12673, lat: 51.50716, routes: ["91"] },
    { id: "490013767C", name: "Trafalgar Square / Charing Cross Stn", indicator: "C", lng: -0.1265, lat: 51.5076, routes: ["24"] },
  ],
}

const listedPins = catalogueBoards(places)
assert.equal(listedPins?.stops.length, 2)
assert.deepEqual(listedPins?.stops[0]?.calls, [])
assert.equal(listedPins?.stops[0]?.clock, "waiting")
assert.equal(listedPins?.stops[0]?.lng, -0.12673)
assert.equal(catalogueBoards(null), null)
assert.equal(catalogueBoards({ ok: false, stops: [] }), null)

console.log("place-arrivals ok")
