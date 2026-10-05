import assert from "node:assert/strict"
import { parseParkingParks, parseParkingSpaces, parksNear, soloParkingRadiusMetres, type ParkingPark } from "./parking-parks.ts"

const near: ParkingPark = {
  id: "near",
  nameTc: "近",
  nameEn: "Near",
  addressTc: "",
  addressEn: "",
  lng: 114.17,
  lat: 22.28,
  heightM: null,
}
const far: ParkingPark = { ...near, id: "far", lng: 114.3, lat: 22.4 }

assert.deepEqual(parksNear([far, near], 114.17, 22.28, 800).map((park) => park.id), ["near"])
assert.equal(parksNear([near, far], 114.17, 22.28, 80_000, 1)[0]?.id, "near")

const parsed = parseParkingParks({
  car_park: [{ park_id: "a", name_tc: "甲", name_en: "A", latitude: 22.2, longitude: 114.1, height: 0, displayAddress_tc: "地址" }],
})
assert.equal(parsed[0]?.heightM, null)
assert.equal(parsed[0]?.addressTc, "地址")

const spaces = parseParkingSpaces({
  car_park: [
    {
      park_id: "a",
      vehicle_type: [
        { type: "P", service_category: [{ category: "HOURLY", vacancy_type: "A", vacancy: 4, lastupdate: "2026-10-05 11:03:05" }] },
        { type: "M", service_category: [{ category: "HOURLY", vacancy_type: "B", vacancy: -1, lastupdate: "" }] },
      ],
    },
  ],
}, "a")
assert.equal(spaces[0]?.vacancy, 4)
assert.equal(spaces[1]?.vacancy, null)
const closeRadius = soloParkingRadiusMetres(18, 22.3)
assert.ok(closeRadius >= 800)
assert.equal(parksNear([near, { ...near, id: "half", lng: 114.175, lat: 22.284 }], 114.17, 22.28, closeRadius).length, 2)

console.log("parking-parks ok")
