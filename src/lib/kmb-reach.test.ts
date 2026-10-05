import assert from "node:assert/strict"
import { GMB_MIN_ZOOM, KMB_MIN_ZOOM, SOLO_PIN_ZOOM, mapViewKey, placePinZoom } from "./kmb-view.ts"
import { isListedKmbRow, kmbReachMetres, STOP_CAP } from "./kmb-reach.ts"

const close = kmbReachMetres(16.5, 22.38274)
assert.ok(close > 650)
assert.ok(kmbReachMetres(13, 22.38274) > 650)
assert.equal(GMB_MIN_ZOOM, 17)
assert.equal(placePinZoom("kmb", "kmb"), KMB_MIN_ZOOM)
assert.equal(placePinZoom("gmb", "gmb"), SOLO_PIN_ZOOM)
assert.equal(placePinZoom("gmb", null), GMB_MIN_ZOOM)
assert.equal(placePinZoom("parking", "parking"), SOLO_PIN_ZOOM)
assert.equal(placePinZoom("citybus", "citybus"), SOLO_PIN_ZOOM)
assert.ok(GMB_MIN_ZOOM > KMB_MIN_ZOOM)
assert.ok(kmbReachMetres(16, 22.305) > 650)
assert.ok(kmbReachMetres(18, 22.305) > 500)
assert.equal(kmbReachMetres(Number.NaN, 22.38), 450)
assert.equal(STOP_CAP, 40)
assert.equal(mapViewKey(114.168, 22.3, 9), "far")
assert.equal(mapViewKey(114.168, 22.3, 12), "114.168,22.300,overview")
assert.notEqual(mapViewKey(113.95, 22.26, 12), mapViewKey(114.168, 22.3, 12))
assert.equal(mapViewKey(114.168, 22.3, 14), "114.168,22.300,wide")
assert.equal(mapViewKey(114.168, 22.3, 16.4), "114.168,22.300,street")
assert.equal(mapViewKey(114.168, 22.3, 18), "114.168,22.300,close")

assert.equal(isListedKmbRow({ eta_seq: 1, route: "85A" }), true)
assert.equal(isListedKmbRow({ eta_seq: 2, route: "85A" }), false)
assert.equal(isListedKmbRow({ eta_seq: 1, route: "  " }), false)
