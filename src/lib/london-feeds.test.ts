import assert from "node:assert/strict"
import { parseBikePoints, parseLaqn, parsePlanningHits, planningStage } from "./city-feeds.ts"
import { CHARGE_POINTS, thamesCrossings } from "./crossings.ts"
import { headline, severityRank, splitDisruptions } from "./disruptions.ts"
import { camerasFromPlaces, isJamCamUrl, viewRotation } from "./jamcams.ts"
import { parseLifts, parseLineStatus, toneOf } from "./line-status.ts"
import { readArrivals } from "./rail-arrivals.ts"
import { bandOf, corridorsFromStatus, summarize } from "./road-status.ts"
import type { Corridor } from "./types.ts"
import { heaviestRain, nswwsSnapshotUrl, parseFloods, parseMetOfficeRss, parseNswws, parseSiteTemperature, parseTemperature, rainStations, weatherBar } from "./warnings.ts"

const now = Date.parse("2026-10-05T10:05:00Z")

// --- Road corridors (TfL /Road) ---
assert.equal(bandOf("Good"), "free")
assert.equal(bandOf("Serious"), "slow")
assert.equal(bandOf("Severe"), "congested")
assert.equal(bandOf("Closure"), "congested")
assert.equal(bandOf("Something new"), "unknown")
const corridors = corridorsFromStatus(
  [
    { id: "a406", displayName: "North Circular (A406)", statusSeverity: "Serious", statusSeverityDescription: "Serious Delays" },
    { id: "blackwall tunnel", displayName: "Blackwall Tunnel", statusSeverity: "Closure", statusSeverityDescription: "Closure" },
    { id: "a1", displayName: "A1", statusSeverity: "Good", statusSeverityDescription: "No Exceptional Delays" },
    { displayName: "No id" },
  ],
  { a406: { name: "North Circular", paths: [[[-0.2, 51.57], [-0.19, 51.58]]] } },
)
assert.equal(corridors.length, 3)
assert.equal(corridors[0]?.band, "slow")
assert.equal(corridors[0]?.paths.length, 1)
assert.equal(corridors[1]?.closed, true)
assert.deepEqual(corridors[2]?.paths, [])
assert.deepEqual(summarize(corridors), { free: 1, slow: 1, congested: 1, unknown: 0 })

// --- Road disruptions (TfL /Road/all/Disruption) ---
assert.equal(headline("A41 Brent Cross flyover renewals - [A406] North Circular Road (Westbound)"), "A41 Brent Cross flyover renewals")
assert.equal(severityRank("Serious"), 3)
assert.equal(severityRank("Minimal"), 1)
const split = splitDisruptions([
  { id: "TIMS-1", point: "[-0.218543,51.576563]", severity: "Serious", category: "Works", subCategory: "TfL works", comments: "Flyover renewals - [A406] North Circular", status: "Active", hasClosures: false, corridorIds: ["a406"] },
  { id: "TIMS-2", point: "[-0.05,51.504]", severity: "Moderate", category: "Traffic Incidents", comments: "Rotherhithe Tunnel - breakdown", status: "Active", location: "Rotherhithe Tunnel (E14)", hasClosures: true },
  { id: "TIMS-3", point: "[-0.1,51.5]", severity: "Minimal", category: "Works", status: "Scheduled" },
  { id: "TIMS-4", point: "[114.17,22.3]", severity: "Serious", category: "Hazard(s)", status: "Active" },
  { id: "TIMS-5", severity: "Serious", category: "Hazard(s)", status: "Active" },
])
assert.equal(split.works.features.length, 1)
assert.equal(split.incidents.features.length, 1)
assert.equal(split.works.features[0]?.properties?.corridors, "a406")
assert.equal(split.works.features[0]?.properties?.rank, 3)
assert.equal(split.incidents.features[0]?.properties?.closure, true)

// --- JamCams (TfL /Place/Type/JamCam) ---
const image = "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00002.00865.jpg"
assert.equal(isJamCamUrl(image), true)
assert.equal(isJamCamUrl("https://example.com/jamcams.tfl.gov.uk/x.jpg"), false)
assert.equal(isJamCamUrl("https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/../x?y"), false)
assert.equal(viewRotation("West"), 270)
assert.equal(viewRotation("North-East"), 45)
assert.equal(viewRotation("Southbound"), 180)
assert.equal(viewRotation("Junction"), null)
const cameras = camerasFromPlaces([
  { id: "JamCams_00002.00865", name: "A406 Billet Upass E", lng: -0.01594, lat: 51.60067, props: { available: "true", imageUrl: image, videoUrl: image.replace(".jpg", ".mp4"), view: "West" } },
  { id: "off", name: "Off", lng: -0.1, lat: 51.5, props: { available: "false", imageUrl: image } },
  { id: "bad", name: "Bad", lng: -0.1, lat: 51.5, props: { imageUrl: "javascript:alert(1)" } },
])
assert.equal(cameras.features.length, 1)
assert.equal(cameras.features[0]?.properties?.rotation, 270)
assert.match(String(cameras.features[0]?.properties?.video), /\.mp4$/)

// --- Line status and lifts ---
assert.equal(toneOf(10), "green")
assert.equal(toneOf(6), "red")
assert.equal(toneOf(9), "amber")
const lines = parseLineStatus(
  [
    { id: "victoria", name: "Victoria", modeName: "tube", lineStatuses: [{ statusSeverity: 6, statusSeverityDescription: "Severe Delays", reason: "Victoria Line: signal failure at Brixton." }] },
    { id: "tram", name: "Tram", modeName: "tram", lineStatuses: [{ statusSeverity: 9, statusSeverityDescription: "Minor Delays" }, { statusSeverity: 5, statusSeverityDescription: "Part Closure" }] },
    { id: "woolwich-ferry", name: "Woolwich Ferry", modeName: "river-bus", lineStatuses: [{ statusSeverity: 10, statusSeverityDescription: "Good Service" }] },
  ],
  (id) => (id === "victoria" ? "#0098D4" : "#7DD3E8"),
)
assert.equal(lines[0]?.tone, "red")
assert.equal(lines[0]?.color, "#0098D4")
assert.equal(lines[1]?.status, "Part Closure")
assert.equal(lines[2]?.tone, "green")
const lifts = parseLifts(
  [
    { stationUniqueId: "940GZZLUWYP", message: "WEMBLEY PARK STATION: no lift service between the street and ticket hall." },
    { stationUniqueId: "940GZZLUXXX", message: "SOMEWHERE ODD STATION: lift closed." },
    { stationUniqueId: "", message: "ignored" },
  ],
  (code) => (code === "940GZZLUWYP" ? "Wembley Park" : null),
)
assert.equal(lifts.length, 2)
assert.equal(lifts[0]?.station, "Wembley Park")
assert.equal(lifts[1]?.station, "Somewhere Odd")

// --- Thames crossings ---
const corridor = (id: string, band: Corridor["band"], closed = false): Corridor => ({ id, name: id, status: closed ? "Closure" : band === "free" ? "Good" : "Serious", detail: "", band, closed, paths: [] })
const crossings = thamesCrossings(
  [corridor("blackwall tunnel", "slow"), corridor("silvertown tunnel", "free")],
  split.incidents.features,
  lines,
)
assert.deepEqual(crossings.map((item) => item.id), ["rotherhithe", "blackwall", "silvertown", "woolwich"])
assert.equal(crossings[0]?.status, "Closed")
assert.equal(crossings[0]?.tone, "red")
assert.equal(crossings[1]?.tone, "amber")
assert.equal(crossings[2]?.tone, "green")
assert.equal(crossings[3]?.status, "Good Service")
assert.equal(thamesCrossings([], [], [])[1]?.status, "No disruption")
assert.equal(CHARGE_POINTS.features.length, 3)

// --- Rail arrivals (TfL /Line/{ids}/Arrivals) ---
const stations: Record<string, string> = { "940GZZLUPCO": "Pimlico", "940GZZLUBXN": "Brixton", "910GFRNDXR": "Farringdon" }
const parsed = readArrivals(
  [
    { lineId: "victoria", naptanId: "940GZZLUPCO", stationName: "Pimlico Underground Station", destinationNaptanId: "940GZZLUBXN", destinationName: "Brixton Underground Station", timeToStation: 90, platformName: "Southbound - Platform 2", vehicleId: "272", timestamp: "2026-10-05T10:04:30Z" },
    { lineId: "victoria", naptanId: "940GZZLUPCO", stationName: "Pimlico Underground Station", destinationName: "Check Front of Train", timeToStation: 300, platformName: "Northbound - Platform 1" },
    { lineId: "elizabeth", naptanId: "910GFRNDNLT", stationName: "Farringdon Rail Station", destinationNaptanId: "910GABWD", destinationName: "Abbey Wood", timeToStation: 4000 },
    { lineId: "elizabeth", naptanId: "910GFRNDNLT", stationName: "Farringdon Rail Station", destinationNaptanId: "910GNOWHERE", destinationName: "Nowhere", timeToStation: 120, platformName: "Platform B" },
  ],
  now,
  {
    resolve: (_line, code, name) => (stations[code] ? code : Object.keys(stations).find((key) => name.startsWith(stations[key] ?? "?")) ?? null),
    nameOf: (code) => stations[code] ?? null,
  },
)
assert.equal(parsed.observations.length, 1)
assert.equal(parsed.observations[0]?.vehicle, "272")
assert.equal(parsed.observations[0]?.ttnt, 1.5)
assert.equal(parsed.observations[0]?.observedAt, Date.parse("2026-10-05T10:04:30Z"))
const pimlico = parsed.boards.find((board) => board.station === "940GZZLUPCO")
assert.equal(pimlico?.trains.length, 2)
assert.equal(pimlico?.trains[0]?.destName, "Brixton")
assert.equal(pimlico?.trains[0]?.plat, "Southbound · 2")
assert.equal(pimlico?.trains[1]?.destName, "Check Front of Train")
const farringdon = parsed.boards.find((board) => board.station === "910GFRNDXR")
assert.equal(farringdon?.trains.length, 1)
assert.equal(farringdon?.trains[0]?.plat, "B")

// --- Weather ---
const rss = `<?xml version="1.0"?><rss><channel><title>Met Office warnings</title>
<item><title>Yellow warning of rain affecting London &amp; South East England</title><description>Heavy rain may bring &lt;b&gt;flooding&lt;/b&gt; in places.</description></item>
<item><title>Amber warning of wind affecting London &amp; South East England</title><description><![CDATA[Strong winds likely.]]></description></item>
<item><title>Something else</title></item>
</channel></rss>`
const metOffice = parseMetOfficeRss(rss)
assert.equal(metOffice.length, 2)
assert.equal(metOffice[0]?.name, "Yellow warning: rain")
assert.equal(metOffice[0]?.detail, "Heavy rain may bring flooding in places.")
assert.equal(metOffice[0]?.urgent, false)
assert.equal(metOffice[1]?.shortName, "Amber wind")
assert.equal(metOffice[1]?.urgent, true)
assert.deepEqual(parseMetOfficeRss("<rss><channel></channel></rss>"), [])
const floods = parseFloods({
  items: [
    { floodAreaID: "065WAF423", description: "River Lee at Tottenham", severityLevel: 2, message: "Flooding is expected." },
    { floodAreaID: "065FAG001", description: "Tidal Thames", severityLevel: 3 },
    { floodAreaID: "old", description: "Lifted", severityLevel: 4 },
  ],
})
assert.equal(floods.length, 2)
assert.equal(floods[0]?.tone, "red")
assert.equal(floods[1]?.kind, "flood")
const gauges = rainStations({ items: [{ notation: "E7050" }, { notation: "4163" }] })
assert.equal(
  heaviestRain(
    {
      items: [
        { measure: "http://environment.data.gov.uk/flood-monitoring/id/measures/E7050-rainfall-tipping_bucket_raingauge-t-15_min-mm", value: 0.4, dateTime: "2026-10-05T10:00:00Z" },
        { measure: "http://environment.data.gov.uk/flood-monitoring/id/measures/4163-rainfall-tipping_bucket_raingauge-t-15_min-mm", value: 9.9, dateTime: "2026-10-05T07:00:00Z" },
        { measure: "http://environment.data.gov.uk/flood-monitoring/id/measures/9999-rainfall-tipping_bucket_raingauge-t-15_min-mm", value: 5, dateTime: "2026-10-05T10:00:00Z" },
      ],
    },
    gauges,
    now,
  ),
  0.4,
)
assert.equal(heaviestRain({ items: [] }, gauges, now), null)
assert.equal(parseTemperature({ current: { temperature_2m: 14.2 } }), 14.2)
assert.equal(parseTemperature({ reason: "overloaded" }), null)
const site = { type: "FeatureCollection", features: [{ type: "Feature", properties: { location: { name: "London" }, timeSeries: [
  { time: "2026-10-05T09:00Z", screenTemperature: 15.1 },
  { time: "2026-10-05T10:00Z", screenTemperature: 16.23 },
  { time: "2026-10-05T11:00Z", screenTemperature: 17.4 },
] } }] }
assert.equal(parseSiteTemperature(site, now), 16.23)
assert.equal(parseSiteTemperature(site, Date.parse("2026-10-05T08:00Z")), null)
assert.equal(parseSiteTemperature({ features: [] }, now), null)
assert.deepEqual(weatherBar([], { temperatureC: 14.2, rainfallMm: 0, rainfallPlace: "" }), { label: "14°C · Dry", tone: "green" })
assert.equal(weatherBar(metOffice, null)?.label, "Yellow rain · Amber wind")

// --- Met Office NSWWS v1.1 warnings with areas ---
const square = (west: number, south: number, east: number, north: number) => [[[[west, south], [east, south], [east, north], [west, north], [west, south]]]]
const nswws = parseNswws({
  type: "FeatureCollection",
  features: [
    { type: "Feature", geometry: { type: "MultiPolygon", coordinates: square(-1.2, 51.1, 0.6, 52) }, properties: { warningId: "a1", warningStatus: "ISSUED", warningLevel: "AMBER", warningLikelihood: 3, weatherType: ["RAIN", "THUNDERSTORM"], warningHeadline: "Heavy showers and thunderstorms", validFromDate: "2026-10-06T09:00:00Z", validToDate: "2026-10-06T21:00:00Z" } },
    { type: "Feature", geometry: { type: "MultiPolygon", coordinates: square(-5, 56, -3, 58) }, properties: { warningId: "scot", warningStatus: "ISSUED", warningLevel: "YELLOW", weatherType: ["SNOW"] } },
    { type: "Feature", geometry: { type: "MultiPolygon", coordinates: square(-0.3, 51.4, 0.1, 51.6) }, properties: { warningId: "gone", warningStatus: "CANCELLED", warningLevel: "RED", weatherType: ["WIND"] } },
  ],
})
assert.equal(nswws.warnings.length, 1)
assert.equal(nswws.warnings[0]?.name, "Amber warning: rain, thunderstorm")
assert.equal(nswws.warnings[0]?.urgent, true)
assert.match(nswws.warnings[0]?.detail ?? "", /^Heavy showers and thunderstorms · Tue 10:00 to Tue 22:00$/)
assert.deepEqual(nswws.warnings[0]?.coordinates, [-0.3, 51.55])
assert.equal(nswws.areas.features.length, 1)
assert.equal(nswws.areas.features[0]?.properties?.level, "amber")
assert.deepEqual(parseNswws({ type: "FeatureCollection", features: [] }), { warnings: [], areas: { type: "FeatureCollection", features: [] } })
const atom = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><link rel="self" type="application/atom+xml" href="https://data.hub.api.metoffice.gov.uk/nswws/v1.1/objects/feed/"/><link rel="related" type="application/vnd.geo+json" href="https://data.hub.api.metoffice.gov.uk/nswws/v1.1/objects/issued/2bcd0163-c365-4f42-8e09-665757e7f59a/" title="Latest version of all issued warnings"/></feed>'
assert.equal(nswwsSnapshotUrl(atom), "https://data.hub.api.metoffice.gov.uk/nswws/v1.1/objects/issued/2bcd0163-c365-4f42-8e09-665757e7f59a/")
assert.equal(nswwsSnapshotUrl('<feed><link rel="related" href="https://evil.example/x"/></feed>'), null)

// --- Santander Cycles, air quality, planning ---
const docks = parseBikePoints([
  { id: "BikePoints_1", commonName: "River Street , Clerkenwell", lat: 51.529, lon: -0.109, additionalProperties: [
    { key: "NbBikes", value: "4" }, { key: "NbStandardBikes", value: "3" }, { key: "NbEBikes", value: "1" }, { key: "NbEmptyDocks", value: "14" }, { key: "NbDocks", value: "19" },
  ] },
  { id: "BikePoints_2", commonName: "Closed", lat: 51.5, lon: -0.1, additionalProperties: [{ key: "Locked", value: "true" }] },
])
assert.equal(docks.length, 1)
assert.deepEqual([docks[0]?.bikes, docks[0]?.ebikes, docks[0]?.empty, docks[0]?.docks], [3, 1, 14, 19])
const air = parseLaqn({
  HourlyAirQualityIndex: {
    LocalAuthority: [
      { Site: { "@SiteCode": "BG1", "@SiteName": "Barking - Rush Green", "@Latitude": "51.563752", "@Longitude": "0.177891", Species: [
        { "@SpeciesCode": "NO2", "@AirQualityIndex": "3", "@AirQualityBand": "Low" },
        { "@SpeciesCode": "PM25", "@AirQualityIndex": "7", "@AirQualityBand": "High" },
      ] } },
      { Site: [{ "@SiteCode": "XX", "@SiteName": "Quiet", "@Latitude": "51.5", "@Longitude": "-0.1", Species: { "@SpeciesCode": "O3", "@AirQualityIndex": "0", "@AirQualityBand": "No data" } }] },
    ],
  },
})
assert.equal(air.length, 2)
assert.equal(air[0]?.index, 7)
assert.equal(air[0]?.species, "PM25")
assert.equal(air[1]?.index, null)
assert.equal(planningStage("Commenced"), "building")
assert.equal(planningStage("Application Under Consideration"), "pending")
assert.equal(planningStage("Approved"), "decided")
const apps = parsePlanningHits({
  hits: { hits: [
    { _source: { id: "Islington-P2025_1266_PRA", lpa_name: "Islington", status: "Commenced", description: "Change of use", site_number: "1 - 3", site_name: "Craftwork Studios", street_name: "Dufferin Street", postcode: null, valid_date: "02/05/2025", actual_commencement_date: "29/07/2026", centroid: { lat: 51.522583, lon: -0.092333 } } },
    { _source: { id: "no-place" } },
  ] },
})
assert.equal(apps.length, 1)
assert.equal(apps[0]?.stage, "building")
assert.equal(apps[0]?.site, "1 - 3, Craftwork Studios, Dufferin Street")

console.log("london feeds ok")
