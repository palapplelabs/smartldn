import assert from "node:assert/strict"
import { addVisit, parseVisitDays } from "./visit-counts.ts"

const first = addVisit([], "2026-10-05", "new")
assert.deepEqual(first, [{ day: "2026-10-05", people: 1, opens: 1 }])
const again = addVisit(first, "2026-10-05", "return")
assert.deepEqual(again, [{ day: "2026-10-05", people: 1, opens: 2 }])
const nextDay = addVisit(again, "2026-10-06", "new")
assert.equal(nextDay[1]?.people, 1)
assert.equal(parseVisitDays("nope").length, 0)
assert.equal(parseVisitDays(JSON.stringify(again))[0]?.opens, 2)

console.log("visit-counts ok")
