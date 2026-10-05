import assert from "node:assert/strict"
import { nextReading } from "./last-reading.ts"

const kept = { ok: true, stops: ["HH650"] }
const failed = { ok: false, error: "Feed failed", stops: [] }
assert.equal(nextReading(null, failed), failed)
assert.equal(nextReading(kept, failed), kept)
assert.deepEqual(nextReading(kept, { ok: true, stops: ["YT119"] }).stops, ["YT119"])
assert.equal(nextReading(failed, failed), failed)
