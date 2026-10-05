import assert from "node:assert/strict"
import { register } from "node:module"
import type { ApproachPoint } from "./types.ts"

const hook = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = new URL("../" + specifier.slice(2) + ".ts", ${JSON.stringify(import.meta.url)})
    return nextResolve(target.href, context)
  }
  return nextResolve(specifier, context)
}
`
register(`data:text/javascript,${encodeURIComponent(hook)}`)

const { crossingsFrom, nearestApproach, warnedCrossings } = await import("./crossings.ts")

function point(id: string, name: string, lng: number, lat: number, legs: ApproachPoint["legs"]): ApproachPoint {
  return { id, name, nameTc: name, coordinates: [lng, lat], legs }
}

const island = point("H2", "堅拿道天橋", 114.18, 22.27, [
  { code: "CH", name: "Cross Harbour Tunnel", minutes: 7, colour: "green" },
  { code: "EH", name: "Eastern Harbour Crossing", minutes: 9, colour: "green" },
  { code: "WH", name: "Western Harbour Crossing", minutes: 12, colour: "amber" },
])
const kowloon = point("K02", "加士居道", 114.18, 22.3, [
  { code: "CH", name: "Cross Harbour Tunnel", minutes: 16, colour: "amber" },
  { code: "EH", name: "Eastern Harbour Crossing", minutes: 13, colour: "green" },
])

const fromIsland = crossingsFrom(island)
assert.deepEqual(fromIsland.map((row) => [row.code, row.minutes, row.slower]), [
  ["CH", 7, 0],
  ["EH", 9, 2],
  ["WH", 12, 5],
])
assert.equal(crossingsFrom(kowloon).some((row) => row.code === "WH"), false)

const nearKowloon = nearestApproach([island, kowloon], { lng: 114.18, lat: 22.305 })
assert.equal(nearKowloon?.id, "K02")
const nearIsland = nearestApproach([island, kowloon], { lng: 114.18, lat: 22.27 })
assert.equal(nearIsland?.id, "H2")

const warned = warnedCrossings([island, kowloon])
assert.deepEqual(warned.map((row) => [row.code, row.minutes, row.fromTc]), [
  ["CH", 16, "加士居道"],
  ["WH", 12, "堅拿道天橋"],
])

console.log("crossings ok")
