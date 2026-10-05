import assert from "node:assert/strict"
import { routesWithoutArrival } from "./stop-routes.ts"

assert.deepEqual(routesWithoutArrival(["24", "29", "N29"], []), ["24", "29", "N29"])
assert.deepEqual(routesWithoutArrival(["24", "29", "N29"], ["24"]), ["29", "N29"])
assert.deepEqual(routesWithoutArrival(["24", "24", " N29 "], []), ["24", "N29"])
assert.deepEqual(routesWithoutArrival(["24"], ["24"]), [])
assert.deepEqual(routesWithoutArrival([], []), [])

console.log("stop-routes ok")
