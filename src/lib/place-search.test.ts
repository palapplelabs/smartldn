import assert from "node:assert/strict"
import { cleanQuery, mergePlaces, photonPlaces, postcodeKind, postcodePlace, stationMatches, type StationEntry } from "./place-search.ts"

assert.equal(cleanQuery("  oxford   circus "), "oxford circus")
assert.equal(cleanQuery("a"), null)
assert.equal(cleanQuery(null), null)
assert.equal(cleanQuery("x".repeat(81)), null)

assert.equal(postcodeKind("SE10 9NN"), "full")
assert.equal(postcodeKind("se109nn"), "full")
assert.equal(postcodeKind("SE10"), "outcode")
assert.equal(postcodeKind("Bank"), null)

const stations: StationEntry[] = [
  { code: "940GZZLUBNK", name: "Bank", lng: -0.0886, lat: 51.5133, lines: ["Central", "Northern"] },
  { code: "940GZZDLBNK", name: "Bank", lng: -0.0887, lat: 51.5134, lines: ["DLR"] },
  { code: "940GZZLUBKG", name: "Barking", lng: 0.0809, lat: 51.5396, lines: ["District"] },
  { code: "940GZZLUEAC", name: "Elephant & Castle", lng: -0.1006, lat: 51.4945, lines: ["Bakerloo", "Northern"] },
  { code: "940GZZLUHPC", name: "Hyde Park Corner", lng: -0.1527, lat: 51.5027, lines: ["Piccadilly"] },
]
const bank = stationMatches("bank", stations)
assert.equal(bank[0]?.name, "Bank")
assert.equal(bank.filter((place) => place.name === "Bank").length, 1, "one row per station name")
assert.equal(bank[0]?.detail, "Central · Northern")
assert.equal(stationMatches("elephant and castle", stations)[0]?.name, "Elephant & Castle")
assert.equal(stationMatches("park corner", stations)[0]?.name, "Hyde Park Corner", "matches from a later word")
assert.deepEqual(stationMatches("zzz", stations), [])

const full = postcodePlace({ status: 200, result: { postcode: "SE10 9NN", longitude: -0.0078, latitude: 51.4822, admin_district: "Greenwich" } })
assert.deepEqual(full && { name: full.name, detail: full.detail, zoom: full.zoom }, { name: "SE10 9NN", detail: "Postcode · Greenwich", zoom: 16.5 })
const outcode = postcodePlace({ status: 200, result: { outcode: "SE10", longitude: -0.01, latitude: 51.48, admin_district: ["Greenwich", "Lewisham"] } })
assert.equal(outcode?.zoom, 14)
assert.equal(outcode?.detail, "Postcode · Greenwich, Lewisham")
assert.equal(postcodePlace({ status: 404, error: "Invalid postcode" }), null)

const photon = photonPlaces({
  features: [
    { properties: { osm_type: "N", osm_id: 1, osm_key: "railway", type: "house", name: "Oxford Circus", street: "Regent Street", district: "Mayfair", postcode: "W1B 3HH" }, geometry: { coordinates: [-0.142, 51.5157] } },
    { properties: { osm_type: "W", osm_id: 2, osm_key: "highway", type: "street", name: "Regent Street", district: "Mayfair" }, geometry: { coordinates: [-0.14, 51.512] } },
    { properties: { osm_type: "N", osm_id: 3, osm_key: "place", type: "district", name: "Greenwich" }, geometry: { coordinates: [-0.0, 51.48] } },
    { properties: { osm_type: "N", osm_id: 4, housenumber: "10", street: "Downing Street", type: "house", osm_key: "building" }, geometry: { coordinates: [-0.1276, 51.5034] } },
    { properties: { name: "No point" }, geometry: {} },
  ],
})
assert.deepEqual(photon.map((place) => [place.name, place.kind]), [["Oxford Circus", "station"], ["Regent Street", "street"], ["Greenwich", "area"], ["10 Downing Street", "place"]])
assert.equal(photon[0]?.detail, "Regent Street, Mayfair, W1B 3HH")
assert.equal(photon[1]?.detail, "Mayfair")
assert.deepEqual(photonPlaces(null), [])

const merged = mergePlaces([bank, photon, [{ ...photon[0]!, id: "osm-N9", name: "Oxford Circus", lng: -0.1419, lat: 51.5156 }]], 5)
assert.equal(merged.filter((place) => place.name === "Oxford Circus").length, 1, "nearby twin dropped")
assert.equal(merged[0]?.name, "Bank", "stations lead")
assert.equal(merged.length, 5)

console.log("place search ok")
