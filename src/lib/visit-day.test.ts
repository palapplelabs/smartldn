import assert from "node:assert/strict"
import { isNewVisit, visitDay } from "./visit-day.ts"

assert.equal(visitDay(new Date("2026-10-04T15:59:00Z")), "2026-10-04")
assert.equal(visitDay(new Date("2026-10-04T16:00:00Z")), "2026-10-05")
assert.equal(isNewVisit(undefined, "2026-10-05"), true)
assert.equal(isNewVisit("2026-10-04", "2026-10-05"), true)
assert.equal(isNewVisit("2026-10-05", "2026-10-05"), false)

console.log("visit-day ok")
