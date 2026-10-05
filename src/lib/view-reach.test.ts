import assert from "node:assert/strict"
import { PLANNING_MIN_ZOOM, SOLO_PIN_ZOOM, STOP_MIN_ZOOM, mapViewKey, placePinZoom } from "./map-view.ts"
import { inLondon, stopReachMetres, viewCacheKey } from "./view-reach.ts"

// Westminster
const lat = 51.5007

assert.ok(stopReachMetres(16.5, lat) >= 350)
assert.ok(stopReachMetres(14, lat) > stopReachMetres(16, lat))
assert.equal(stopReachMetres(Number.NaN, lat), 450)
assert.equal(viewCacheKey(-0.1246, lat, 16), viewCacheKey(-0.12462, lat, 16))

assert.equal(placePinZoom("bus", "bus"), STOP_MIN_ZOOM)
assert.equal(placePinZoom("bus", null), STOP_MIN_ZOOM)
assert.equal(placePinZoom("planning", null), PLANNING_MIN_ZOOM)
assert.equal(placePinZoom("planning", "planning"), SOLO_PIN_ZOOM)
assert.equal(placePinZoom("cycles", "cycles"), SOLO_PIN_ZOOM)

assert.equal(mapViewKey(-0.1246, lat, 9), "far")
assert.equal(mapViewKey(-0.1246, lat, 12), "-0.125,51.501,overview")
assert.equal(mapViewKey(-0.1246, lat, 15), "-0.125,51.501,wide")
assert.equal(mapViewKey(-0.1246, lat, 16.4), "-0.125,51.501,street")
assert.equal(mapViewKey(-0.1246, lat, 18), "-0.125,51.501,close")
assert.notEqual(mapViewKey(-0.0235, 51.5054, 12), mapViewKey(-0.1246, lat, 12))

assert.equal(inLondon(-0.1246, lat), true)
assert.equal(inLondon(0.2596, 51.4655), true)
assert.equal(inLondon(114.17, 22.3), false)
assert.equal(inLondon(-2.24, 53.48), false)
