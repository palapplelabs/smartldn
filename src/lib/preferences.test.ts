import assert from "node:assert/strict"
import { PREFERENCE_DEFAULTS, chooseWatchedLayer, layersBeside, readPreferences, soleLayer, soloLayers } from "./preferences.ts"

const saved = readPreferences(JSON.stringify({
  layers: { bus: false, river: false, roads: "yes" },
  basemap: "street",
  ground: "street",
  intelOpen: false,
  intelTab: "transit",
  barOpen: false,
}))
assert.equal(saved.layers.bus, false)
assert.equal(saved.layers.river, false)
assert.equal(saved.layers.roads, true)
assert.equal(saved.layers.rail, true)
assert.equal(saved.basemap, "street")
assert.equal(saved.intelOpen, false)
assert.equal(saved.intelTab, "transit")
assert.equal(saved.barOpen, false)

assert.deepEqual(readPreferences("not-json"), PREFERENCE_DEFAULTS)
assert.equal(readPreferences(JSON.stringify({ intelTab: "boundary", basemap: "moon" })).intelTab, "ranked")
assert.equal(readPreferences(JSON.stringify({ basemap: "moon" })).basemap, "satellite")
assert.equal(PREFERENCE_DEFAULTS.layers.planning, false)

const onlyCycles = soloLayers(PREFERENCE_DEFAULTS.layers, "cycles")
assert.equal(onlyCycles.cycles, true)
assert.equal(onlyCycles.bus, false)
assert.equal(soleLayer(onlyCycles), "cycles")
assert.equal(soleLayer(PREFERENCE_DEFAULTS.layers), null)
const beside = layersBeside(onlyCycles, "air")
assert.equal(beside?.cycles, true)
assert.equal(beside?.air, true)
assert.equal(beside?.rail, false)
assert.equal(layersBeside(onlyCycles, "cycles"), null)
assert.equal(layersBeside(PREFERENCE_DEFAULTS.layers, "air"), null)
const added = chooseWatchedLayer(true, onlyCycles, "air")
assert.equal(added.only, false)
assert.equal(added.layers.cycles, true)
assert.equal(added.layers.air, true)
const switchedOff = chooseWatchedLayer(true, onlyCycles, "cycles")
assert.equal(switchedOff.layers.cycles, false)
const first = chooseWatchedLayer(true, PREFERENCE_DEFAULTS.layers, "cycles")
assert.equal(first.only, true)
assert.equal(soleLayer(first.layers), "cycles")
const plain = chooseWatchedLayer(false, onlyCycles, "bus")
assert.equal(plain.layers.cycles, true)
assert.equal(plain.layers.bus, true)

console.log("preferences ok")
