import assert from "node:assert/strict"
import { PREFERENCE_DEFAULTS, chooseWatchedLayer, layersBeside, readPreferences, soleLayer, soloLayers } from "./preferences.ts"

const saved = readPreferences(JSON.stringify({
  locale: "en",
  layers: { kmb: false, ferry: false, speed: "yes" },
  basemap: "street",
  ground: "street",
  intelOpen: false,
  intelTab: "boundary",
  barOpen: false,
  pinnedOrigin: "H12",
}))
assert.equal(saved.locale, "en")
assert.equal(saved.layers.kmb, false)
assert.equal(saved.layers.ferry, false)
assert.equal(saved.layers.mtr, true)
assert.equal(saved.basemap, "street")
assert.equal(saved.intelOpen, false)
assert.equal(saved.intelTab, "boundary")
assert.equal(saved.barOpen, false)
assert.equal(saved.pinnedOrigin, "H12")

assert.equal(readPreferences("not-json").locale, PREFERENCE_DEFAULTS.locale)
assert.equal(readPreferences(JSON.stringify({ locale: "fr", intelTab: "nope", basemap: "moon" })).intelTab, "ranked")
assert.equal(readPreferences(JSON.stringify({ pinnedOrigin: null })).pinnedOrigin, null)

const onlyParking = soloLayers(PREFERENCE_DEFAULTS.layers, "parking")
assert.equal(onlyParking.parking, true)
assert.equal(onlyParking.gmb, false)
assert.equal(onlyParking.kmb, false)
assert.equal(PREFERENCE_DEFAULTS.layers.gmb, true)
assert.equal(soleLayer(onlyParking), "parking")
assert.equal(soleLayer(PREFERENCE_DEFAULTS.layers), null)
const beside = layersBeside(onlyParking, "gmb")
assert.equal(beside?.parking, true)
assert.equal(beside?.gmb, true)
assert.equal(beside?.kmb, false)
assert.equal(beside?.mtr, false)
assert.equal(onlyParking.gmb, false)
assert.equal(layersBeside(onlyParking, "parking"), null)
assert.equal(layersBeside(PREFERENCE_DEFAULTS.layers, "gmb"), null)
const added = chooseWatchedLayer(true, onlyParking, "gmb")
assert.equal(added.only, false)
assert.equal(added.layers.parking, true)
assert.equal(added.layers.gmb, true)
assert.equal(added.layers.kmb, false)
const switchedOff = chooseWatchedLayer(true, onlyParking, "parking")
assert.equal(switchedOff.only, false)
assert.equal(switchedOff.layers.parking, false)
const first = chooseWatchedLayer(true, PREFERENCE_DEFAULTS.layers, "parking")
assert.equal(first.only, true)
assert.equal(soleLayer(first.layers), "parking")
const plain = chooseWatchedLayer(false, onlyParking, "kmb")
assert.equal(plain.only, false)
assert.equal(plain.layers.parking, true)
assert.equal(plain.layers.kmb, true)

console.log("preferences ok")
