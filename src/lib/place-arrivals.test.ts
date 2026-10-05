import assert from "node:assert/strict"
import { catalogueBoards, etaDue, forgetStale, heldRows, ETA_FRESH_MS, ETA_KEEP_MS } from "./place-arrivals.ts"
import { readStopList } from "./stop-list.ts"

const now = 1_700_000_000_000

assert.equal(etaDue(undefined, now), true)
assert.equal(etaDue({ at: now - ETA_FRESH_MS + 1, rows: [] }, now), false)
assert.equal(etaDue({ at: now - ETA_FRESH_MS, rows: [] }, now), true)

assert.equal(heldRows(undefined, now), null)
assert.deepEqual(heldRows({ at: now - ETA_KEEP_MS, rows: ["85A"] }, now), ["85A"])
assert.equal(heldRows({ at: now - ETA_KEEP_MS - 1, rows: ["85A"] }, now), null)

const memory = new Map<string, { at: number; rows: string[] }>([
  ["fresh", { at: now - 1_000, rows: ["1"] }],
  ["old", { at: now - ETA_KEEP_MS - 1, rows: ["2"] }],
])
forgetStale(memory, now)
assert.deepEqual([...memory.keys()], ["fresh"])

const places = {
  ok: true,
  stops: [
    { id: "hotel", nameTc: "麗豪酒店", nameEn: "Regal Riverside Hotel", lng: 114.196, lat: 22.383 },
    { id: "garden", nameTc: "河畔花園", nameEn: "Garden Rivera", lng: 114.195, lat: 22.382 },
  ],
}

const listedPins = catalogueBoards(places)
assert.equal(listedPins?.stops.length, 2)
assert.deepEqual(listedPins?.stops[0]?.calls, [])
assert.equal(listedPins?.stops[0]?.clock, "waiting")
assert.equal(listedPins?.stops[0]?.lng, 114.196)
assert.equal(catalogueBoards(null), null)

const listed = readStopList({
  data: [
    { stop: "ST1", name_tc: "麗豪酒店", name_en: "Regal Riverside Hotel", lat: "22.38274", long: "114.19587" },
    { stop: "bad", name_tc: "no", name_en: "no", lat: "0", long: "0" },
    { stop: "", name_tc: "x", name_en: "x", lat: "22.3", long: "114.2" },
  ],
}, 1)
assert.deepEqual(listed, {
  ST1: { tc: "麗豪酒店", en: "Regal Riverside Hotel", lng: 114.19587, lat: 22.38274 },
})
assert.equal(readStopList({ data: [] }, 1), null)
assert.equal(readStopList({ data: {} }, 1), null)
