import assert from "node:assert/strict"
import { indexPoints, mates } from "./point-index.ts"

const index = indexPoints([
  { id: "b", lng: 114.168095, lat: 22.300341 },
  { id: "a", lng: 114.168095, lat: 22.300341 },
  { id: "c", lng: 114.167947, lat: 22.300246 },
])

assert.deepEqual(mates(index, "b", 114.168095, 22.300341).sort(), ["a", "b"])
assert.deepEqual(mates(index, "c", 114.167947, 22.300246), ["c"])

console.log("point-ok")
