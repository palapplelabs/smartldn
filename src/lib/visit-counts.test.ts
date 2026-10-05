import assert from "node:assert/strict"
import { addVisit, parseVisitDays } from "./visit-counts.ts"

const first = addVisit([], "2026-10-05")
assert.deepEqual(first, [{ day: "2026-10-05", opens: 1 }])
const again = addVisit(first, "2026-10-05")
assert.deepEqual(again, [{ day: "2026-10-05", opens: 2 }])
const nextDay = addVisit(again, "2026-10-06")
assert.deepEqual(nextDay.map((item) => item.opens), [2, 1])
assert.equal(parseVisitDays("nope").length, 0)
// Older stored rows with a people count still read back.
assert.deepEqual(parseVisitDays(JSON.stringify([{ day: "2026-10-05", people: 3, opens: 5 }])), [{ day: "2026-10-05", opens: 5 }])

console.log("visit-counts ok")
