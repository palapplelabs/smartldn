import assert from "node:assert/strict"
import { visitDay } from "./visit-day.ts"

// London days, across the October clock change (BST ends 25 October 2026).
assert.equal(visitDay(new Date("2026-10-04T22:59:00Z")), "2026-10-04")
assert.equal(visitDay(new Date("2026-10-04T23:00:00Z")), "2026-10-05")
assert.equal(visitDay(new Date("2026-12-01T23:59:00Z")), "2026-12-01")

console.log("visit-day ok")
