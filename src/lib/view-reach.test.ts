import assert from "node:assert/strict"
import { PLANNING_MIN_ZOOM, SOLO_PIN_ZOOM, STOP_MIN_ZOOM, busViewQuery, mapViewKey, placePinZoom } from "./map-view.ts"
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
assert.equal(mapViewKey(-0.1246, lat, 12), "-0.125,51.501,overview,12")
assert.equal(mapViewKey(-0.1246, lat, 15), "-0.125,51.501,wide,15")
assert.equal(mapViewKey(-0.1246, lat, 16.4), "-0.125,51.501,street,16.5")
assert.equal(mapViewKey(-0.1246, lat, 18), "-0.125,51.501,close,18")
assert.notEqual(mapViewKey(-0.0235, 51.5054, 12), mapViewKey(-0.1246, lat, 12))

assert.equal(inLondon(-0.1246, lat), true)
assert.equal(inLondon(0.2596, 51.4655), true)
assert.equal(inLondon(114.17, 22.3), false)
assert.equal(inLondon(-2.24, 53.48), false)

assert.equal(busViewQuery({ lng: -0.1, lat: 51.5, zoom: 13, bounds: [-0.1234, 51.4876, -0.0761, 51.5123] }), "w=-0.13&s=51.48&e=-0.07&n=51.52")
