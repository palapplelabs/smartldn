import assert from "node:assert/strict"
import lines from "../../data/strategic-centerlines.json" with { type: "json" }

const byId = new Map(lines.map((line) => [line.id, line]))

const route3 = byId.get("3709")
assert.ok(route3)
assert.equal(route3.roadEn, "Route 3")
assert.equal(route3.roadTc, "三號幹線")

const flyover = byId.get("5230")
assert.ok(flyover)
assert.equal(flyover.roadEn, "Flyover (Connaught Road West)")
assert.equal(flyover.roadTc, "天橋 (干諾道西)")

const named = byId.get("1984")
assert.ok(named)
assert.equal(named.roadEn, "WONG NAI CHUNG GAP ROAD")
assert.equal(named.roadTc, "黃泥涌峽道")

const unnamed = lines.filter((line) => line.roadEn === "Strategic road")
assert.equal(unnamed.length, 24)
assert.equal(unnamed.every((line) => line.roadTc === "策略性道路"), true)
