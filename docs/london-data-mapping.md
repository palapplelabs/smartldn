# SmartLDN — Hong Kong → Greater London data mapping

Status: decisions taken 2026-10-05 (see §7). Phase 1 port done on branch london-port; BODS bus positions, Street Manager and Met Office DataHub are phase 2.
Date of research: 2026-10-05. Every "Verified" endpoint below was called live on that date.

---

## 1. What the current (Hong Kong) app does

Next.js 16 + React 19 + MapLibre GL + Tailwind, deployed as a Cloudflare Worker (vinext). One full-screen map with:

| Area | Feature | Code |
| --- | --- | --- |
| Header | Clock, language switch (zh-HK / zh-CN / en), "Updates" changelog, daily visit counter | `ops-hud.tsx`, `changelog.ts`, `proxy.ts` + `visits.ts` (Cloudflare KV + Analytics Engine) |
| Header | Harbour-crossing minutes (Cross / Eastern / Western tunnel) from the nearest roadside journey-time sign, or a pinned sign; "fastest of three" | `api/approaches`, `approaches.ts`, `crossings.ts` |
| Header | Observatory temperature and past-hour rainfall | `api/warnings` |
| Intel panel | Ranked "what matters now" list, with tabs Ranked / Roads / Boundary / Weather / Systems / Notes. Scores feed faults, open incidents, very busy boundary halls, bad roads, works and weather warnings | `intel.ts` |
| Map layers (14) | speed, cameras, works, tolls, incidents, control (boundary), mtr, lrt, kmb, citybus, gmb, nlb, ferry, parking | `layer-dock.tsx`, `city-map.tsx`, `map-cards.ts` |
| Basemaps | Satellite (Esri), Streets (OpenFreeMap Bright), 3D Buildings (OpenFreeMap Liberty) + terrain (AWS Terrarium DEM, HK-specific repair) | `city-map.tsx`, `terrain-tile.ts` |
| Trains | Animated train dots between stations, estimated from next-train minutes, since MTR publishes no position | `mtr-estimate.ts`, `mtr-run.ts`, `lrt-feed.ts` |
| Buses | Stop boards (pole plates) with ETAs, loaded only for stops in view; five operators | `*-feed.ts`, `stop-board.ts`, `view-cache.ts` |
| Ferries | Pier boards, and boats that move along fairways from sailing time or from the Sun Ferry GPS position | `ferry-*.ts` |
| Caching | One shared upstream copy per feed (12 s to 24 h TTL), polite fetch, view-bucket cache | `upstream.ts`, `feed-cache.ts`, `polite-fetch.ts` |
| Static data | `data/*.json`: bus networks, MTR network, LRT stations, ferry piers, road centrelines, road-point gazetteer (for placing incidents) | `data/` |

---

## 2. Feed-by-feed mapping

Legend: ✅ direct equivalent · 🟡 partial or different shape · ❌ none (omit) · 🔑 free key or registration needed

### 2.1 Roads

| HK feature / feed | London equivalent | Status | Notes |
| --- | --- | --- | --- |
| **Strategic road speed + TD grade (Good / Average / Bad)**: TD detector XML `rawSpeedVol-all.xml`, `irnAvgSpeed-all.xml`, HKeMobility saturation WFS | **TfL Road corridor status** `GET https://api.tfl.gov.uk/Road` and `/Road/{ids}/Status`: 24 corridors (A1, A10, A12, A13, A2, A20, A205 South Circ, A21, A23, A24, A3, A316, A4, A40, A406 North Circ, A41, Bishopsgate / City / Farringdon / Western cross routes, Inner Ring, Southern River Route, Blackwall Tunnel, Silvertown Tunnel), each with severity Good / Serious / Severe / Closure, plus a bounding box. Verified. | 🟡 | **London publishes no open per-link live speed.** The grade maps cleanly (Good→Good, Serious→Average, Severe/Closure→Bad), but it is corridor-wide and has **no km/h**. For motorways (M25, M1, M4, M11, A1(M), A282 Dartford) **National Highways NTIS DATEX II** carries live speeds and journey times 🔑. It is a push subscription via trafficengland.com subscriber pages, which needs a server endpoint, so it is heavy for a Worker. Commercial alternative: TomTom or HERE flow tiles (paid). **Decision needed.** |
| Road shapes: TD Road Network v2 centrelines | **OS Open Roads** (OGL, GeoPackage) or **OpenStreetMap**, clipped to the 24 corridor routes and built once into `data/strategic-centerlines.json` | ✅ | TfL corridor responses give only a bounding box, so geometry has to be pre-built. |
| Smart-lamppost traffic detectors | — | ❌ | No open London equivalent. Vivacity and borough sensors are not open. **Omit.** |
| **Harbour-crossing journey times** (3 tunnels, from nearest sign, "fastest") | **Thames crossings east of Tower Bridge**: Rotherhithe Tunnel, Blackwall Tunnel, Silvertown Tunnel (opened Apr 2025, tolled), Woolwich Ferry, Dartford Crossing (A282). Sources: TfL corridor status for Blackwall and Silvertown; TfL disruptions filtered to the Rotherhithe Tunnel; TfL line status `woolwich-ferry`; Dartford via National Highways closures API 🔑 / NTIS journey times 🔑 | 🟡 | London has **no open journey-time-sign feed**, so "minutes from nearest sign" is impossible on open data. It can become a **"River crossings" strip**: status per crossing (Good / Serious / Severe / Closed + active disruption text). Real minutes only for Dartford, and only with NTIS. **Decision needed.** |
| **Cameras** (HKeMobility snapshots, EN + TC) | **TfL JamCams** `GET /Place/Type/JamCam`: **890 cameras** with lat/lon, view direction, a JPG `imageUrl` *and a ~10 s MP4 `videoUrl`* on `s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/`. Verified. | ✅+ | Better than HK, because each camera also has a short video clip. The camera proxy allowlist (`isCameraSnapshotUrl`) must switch to the JamCams S3 host. National Highways motorway CCTV is only on the NTIS subscriber service 🔑 (optional). |
| **Road works** (HKeMobility WFS) | (a) **TfL Road Disruptions** `GET /Road/all/Disruption`: 111 live today (105 Works), each with point, severity, category / subCategory, comments, currentUpdate, start/end, corridorIds, hasClosures. (b) `GET /Road/all/Street/Disruption?startDate&endDate` returns **per-street line geometry** (`lineString`) and a closure flag (175 today). Verified. (c) **DfT Street Manager open data**: every street-works permit in England, from utilities and all 33 highway authorities incl. **London boroughs**, OGL, near real-time via AWS SNS push 🔑 (needs a public HTTPS POST endpoint) plus monthly archives. | ✅+ | TfL covers the main roads (TLRN) and major borough works. Street Manager adds **borough-street works** (gas, water, telecoms) at much finer grain. That is far more than HK's works layer, and better suited to "construction". **Decision needed on adding Street Manager.** |
| **Special traffic news** (TD `trafficnews.xml`) | Same TfL Road Disruptions feed, filtered to categories *Traffic Incidents*, *Hazard(s)*, *Infrastructure Issue*, *Special and Planned Events* (vs *Works*). Also available as the London Datastore "TfL Live Traffic Disruptions" XML (5-min refresh). | ✅ | Real coordinates are supplied, so HK's `road-points.json` gazetteer and text-matching (`incidents.ts` `placeIncident`) are no longer needed. That is a simplification. |
| **Toll points** (harbour tunnels, Tai Lam) | Road user charging in London. **Point charges**: Blackwall + Silvertown Tunnel charge (since 7 Apr 2025) and Dartford Crossing (Dart Charge). **Zone boundaries**: Congestion Charge zone and London-wide ULEZ (London Datastore GeoJSON, OGL). | ✅ (static) | These are static, hand-curated points plus polygons, the same as HK. Drawing the CCZ and ULEZ polygons is new. |

### 2.2 Boundary

| HK feature / feed | London equivalent | Status | Notes |
| --- | --- | --- | --- |
| **Land boundary control points**: ImmD waiting times for 8 crossings × resident/visitor × arrival/departure, plus the strategic road approach to each | — | ❌ | London has no land border, and no airport, Eurostar or Port of Dover queue time is published as open data. **Omit the "control" layer and the Intel "Boundary" tab.** See §4 for a possible replacement tab. |

### 2.3 Rail

| HK feature / feed | London equivalent | Status | Notes |
| --- | --- | --- | --- |
| **MTR next train** (`getSchedule.php`, per line × station) | **TfL arrivals** `GET /Line/{ids}/Arrivals` (whole line in one call) or `/StopPoint/{id}/Arrivals`. Covers **11 Tube lines, Elizabeth line, 6 Overground lines (Liberty, Lioness, Mildmay, Suffragette, Weaver, Windrush)**. Fields: vehicleId, platformName, destinationName, towards, timeToStation, expectedArrival, **`currentLocation`**. Verified: Victoria line returned 78 predictions, e.g. `"At Pimlico"`. | ✅+ | Tube predictions carry `currentLocation` ("At X", "Between X and Y", "Approaching X"), and `vehicleId` lets one train be followed across stations. Train dots can therefore be placed from published text, which is better than HK, where position had to be inferred from minutes. Elizabeth and Overground leave `currentLocation` empty, so the existing minutes-based estimator (`mtr-estimate.ts`) is still needed there. |
| MTR station footprints (Lands Dept CSDI) / `mtr-network.json` | **TfL** `GET /Line/{id}/Route/Sequence/{inbound\|outbound}` gives ordered stations **and `lineStrings` geometry** for each line. Station coordinates come from `/StopPoint/Mode/tube,...`. NaPTAN for entrances. | ✅ | Build once into `data/` (rail network, ~430 stations). |
| — (no HK equivalent shown) | **Line status** `GET /Line/Mode/tube,dlr,elizabeth-line,overground,tram,cable-car,river-bus/Status` gives Good Service / Minor Delays / Severe Delays / Part Closure / Planned Closure + reason text. Verified: Victoria "Severe Delays", Tram "Part Closure". | ➕ | **Essential for London.** It should feed the Intel ranking, which is currently roads-only. See §3. |
| **Light Rail next train** (Tuen Mun / Yuen Long) | **DLR** (`/Line/dlr/Arrivals`, 271 predictions) and **London Trams** (`/Line/tram/Arrivals`). Verified. | ✅ | Same treatment as HK LRT. |
| — | **IFS Cloud Cable Car** (`london-cable-car`): status only | ➕ | Small. Could go in the rail layer as status only. |
| — | **National Rail** (Southern, Southeastern, SWR, Thameslink, GWR, c2c etc. into the termini) via **Darwin Live Departure Boards REST on the Rail Data Marketplace** (raildata.org.uk), free 🔑. The legacy OpenLDBWS SOAP tokens were retired in early 2026. | ➕ | Big coverage gain for outer London. **Decision needed.** |

### 2.4 Buses

| HK feature / feed | London equivalent | Status | Notes |
| --- | --- | --- | --- |
| **KMB + Long Win, Citybus, Green Minibus, New Lantao Bus**: five operators, five APIs, five layers | **London Buses (TfL)**: one network, **672 routes**, ~19 k stops. `GET /StopPoint/{naptanId}/Arrivals` (stop board) and `/Line/{id}/Arrivals`. Verified: route 24 returned 205 predictions with vehicleId (reg), stop, destination, timeToStation and bearing. | ✅ | Collapses into **one "Bus" layer**. Most bus code simplifies: `kmb-*`, `citybus-*`, `gmb-*`, `nlb-*`, `bus-company.ts`, `gmb-destinations`, `lwb-routes` all merge into one TfL bus feed. The view-bucket stop loading (`view-cache.ts`, `kmb-reach.ts`) is still needed, because 19 k stops is a lot. |
| HK bus position: none (scheduled / ETA only) | **Live bus GPS positions** from **DfT Bus Open Data Service (BODS)** SIRI-VM / GTFS-RT, every 10–30 s, operator `TFLO`. Free 🔑. TfL is legally exempt but has published there since Nov 2021. | ➕ | **New capability**: real moving buses. Data-quality caveats were reported (route ids, destinations). The bounding-box query can cover all of Greater London. **Decision needed.** |
| — | **Coaches** (National Express, Green Line, etc.) also in BODS | ➕ | Low priority. |

### 2.5 River

| HK feature / feed | London equivalent | Status | Notes |
| --- | --- | --- | --- |
| **Ferries**: Sun Ferry ETA + GPS, HKKF ETA, Star Ferry CSV timetable, Fortune Ferry timetable | **Uber Boat by Thames Clippers** RB1, RB4, RB6 via TfL `/Line/rb1,rb4,rb6/Arrivals` (verified: predictions with vehicleId and pier). **Woolwich Ferry** via TfL line status. Pier locations from `/StopPoint/Mode/river-bus`. Timetable fallback from TfL Journey Planner timetables (`/Line/{id}/Timetable/{from}`). | ✅ | Star Ferry and Fortune Ferry go away. Boats are animated along a hand-drawn Thames fairway, the same as HK's `ferry-fairway.ts`. |
| Sun Ferry boat GPS | **AIS** via **aisstream.io** WebSocket (free 🔑), bounding box on the Thames. Clipper MMSIs are public. | 🟡 | WebSockets need a server holder. That fits a Durable Object on Cloudflare, but adds infrastructure. **Optional.** |

### 2.6 Weather

| HK feature / feed | London equivalent | Status | Notes |
| --- | --- | --- | --- |
| **HKO warning summary** (typhoon signals, rainstorm amber/red/black, etc.) | **Met Office National Severe Weather Warnings**, RSS for *London & South East England* `https://www.metoffice.gov.uk/public/data/PWSCache/WarningsRSS/Region/se`. Yellow / Amber / Red × rain, wind, snow, ice, fog, thunderstorm, extreme heat. No key. Verified 200. | ✅ | Map warning colour to Intel tone (Yellow → amber, Amber / Red → red, urgent). |
| — | **Environment Agency flood warnings** `https://environment.data.gov.uk/flood-monitoring/id/floods?lat=51.5074&long=-0.1278&dist=40`: Flood Alert / Flood Warning / Severe Flood Warning, real-time, no key. Verified (0 active today). | ➕ | Covers the tidal Thames and London tributaries. Strongly suggested for the Weather tab. |
| **HKO temperature** (`rhrread`) | **Met Office Weather DataHub, Land Observations** (hourly, St James's Park / Heathrow / London City / Northolt). Free tier 360 calls/day 🔑. That is enough at a 5-min server cache (288/day). Keyless fallback: **Open-Meteo** `ukmo` model. | ✅ 🔑 | |
| **HKO past-hour rainfall** | **EA rainfall gauges** `/flood-monitoring/id/stations?parameter=rainfall&lat=51.5074&long=-0.1278&dist=25`: 41 gauges, 15-min readings, no key. Verified. | ✅ | Gives "Past hour X mm in {place}", the same as HK. |

### 2.7 Parking

| HK feature / feed | London equivalent | Status | Notes |
| --- | --- | --- | --- |
| **TD car-park vacancy** (all public car parks, live) | TfL `/Occupancy/CarPark` returns **HTTP 500** (verified). It only ever covered ~58 station car parks. `/Occupancy/ChargeConnector` is **retired** (verified 403). Borough parking bays (Southwark, Camden on London Datastore) are **static** polygons with no vacancy. | ❌ (live) | **No open live car-park vacancy for London.** Options: drop the layer, or **replace** it with Santander Cycles docks and/or EV charger availability (§4). **Decision needed.** |

### 2.8 Basemap, terrain and platform

| HK | London | Notes |
| --- | --- | --- |
| OpenFreeMap Bright / Liberty, Esri World Imagery | Same, unchanged (global) | Optional: OS Open Zoomstack (OGL) vector tiles. |
| AWS Terrarium DEM + `terrain-tile.ts` repair, with HK constants (max 957 m Tai Mo Shan, SRTM smoothing) | Same tiles, London constants: max ≈ 245 m (Westerham Heights), min ≈ −5 m. London is flat, so terrain could also simply be **disabled**. Better option: EA LIDAR 1 m DTM (OGL), but that means self-hosted tiles. | |
| Opening fly-through camera over Victoria Harbour | Re-script the fly-through over the Thames (City → Canary Wharf → Greenwich) | |
| i18n zh-HK default, zh-CN via OpenCC, en; `works-chinese.ts` | London: **English default**. Chinese machinery (`opencc-js`, `works-chinese.ts`, TC/SC fields) can go. | **Decision needed.** |
| Visit counter on Cloudflare KV `f7b62c64…` (author's account) | Must point at **your own** KV / Analytics Engine IDs, or be removed. | |
| Branding "HK Traffic Intelligence", Keith Li credits | Rebrand to SmartLDN. The MIT licence **requires keeping the original copyright notice**. The README asks forks to credit the original. | |

---

## 3. Summary: layers and Intel tabs after the port

| HK layer | London layer | Feed |
| --- | --- | --- |
| speed | **Roads** (corridor status) | TfL `/Road` (+ NTIS speeds if approved) |
| cameras | **Cameras** (JPG + video) | TfL JamCams |
| works | **Works** | TfL disruptions *Works* (+ Street Manager if approved) |
| tolls | **Charges** (Dartford, Blackwall / Silvertown points + CCZ / ULEZ polygons) | static |
| incidents | **Incidents** | TfL disruptions, non-works |
| control | — removed — | — |
| mtr | **Tube / Elizabeth / Overground** | TfL arrivals + line status |
| lrt | **DLR / Tram** | TfL arrivals |
| kmb, citybus, gmb, nlb | **Bus** (one layer) | TfL stop arrivals (+ BODS positions if approved) |
| ferry | **River** (Uber Boat, Woolwich Ferry) | TfL arrivals + status |
| parking | — removed, or replaced (§4) — | — |

Intel tabs: Ranked / Roads / ~~Boundary~~ → **Transit** (line status, lift outages) / Weather (+ flood) / Systems / Notes. Line disruptions (Severe Delays, Part Closure, Suspended) join the ranking.

Header: ~~Harbour minutes~~ → **Thames crossings status strip** (Rotherhithe, Blackwall, Silvertown, Woolwich Ferry, Dartford) + temperature / rain.

---

## 4. Extra London-only data (proposals, your call)

| # | Proposal | Source | Live? | Key | Effort | My view |
| --- | --- | --- | --- | --- | --- | --- |
| A | **Tube / rail line status** in the header and Intel ranking | TfL `/Line/Mode/.../Status` | yes | no | S | **Strongly recommend.** It is the London equivalent of "is my road Bad". |
| B | **Live bus positions** (moving buses) | DfT BODS SIRI-VM / GTFS-RT | 10–30 s | free | M | Recommend |
| C | **Santander Cycles docks**: bikes / e-bikes / empty docks at 800 stations | TfL `/BikePoint` (verified 800) | ~5 min | no | S | **Recommend.** Natural replacement for the parking layer. |
| D | **Station crowding**, live "% of usual busyness" | TfL `/Crowding/{naptan}/Live` (verified) | yes | no | S | Recommend, in station popups |
| E | **Lift / step-free outages** | TfL `/Disruptions/Lifts/v2/` (19 today, verified) | yes | no | S | Recommend, in station popup + Transit tab |
| F | **National Rail departures** at London termini and outer stations | Darwin LDB REST, Rail Data Marketplace | yes | free | M | Recommend if outer London matters |
| G | **Street Manager street works** (every borough road permit) | DfT Street Manager open data (SNS push) | near-RT | registration + webhook endpoint | M–L | Good fit for "construction / road works", but needs a webhook receiver + storage (KV / D1) |
| H | **Planning applications** (all 35 London planning authorities) | **GLA London Planning Datahub** Elasticsearch `POST https://planningdata.london.gov.uk/api-guest/applications/_search` (verified, no key) | daily | no | M | Recommend for the "city planning" angle, e.g. major developments / construction starts in view |
| I | **Air quality**: hourly index by site | **LAQN** (Imperial ERG) `api.erg.ic.ac.uk/AirQuality/...` (verified, no key); **Breathe London** 600+ sensors (free 🔑) | hourly | no / free | S–M | Optional layer |
| J | **Flood warnings + Thames levels** | EA flood-monitoring API (verified) | 15 min | no | S | Recommend inside Weather |
| K | **CCZ / ULEZ boundaries** | London Datastore GeoJSON | static | no | S | Recommend inside Charges |
| L | **Motorway speeds + Dartford journey time + NH CCTV** | National Highways NTIS DATEX II push / NH Developer Portal (closures, VMS) | 1 min | registration + endpoint | L | Only if you want real km/h on M25-ish roads |
| M | **Thames boat AIS positions** | aisstream.io WebSocket | seconds | free | M | Nice-to-have |
| N | **Dockless e-bikes / e-scooters** (Lime, Forest, Voi) | Operator GBFS feeds (Lime's is public; others vary) | yes | varies | M | Low priority |
| O | **EV charger live availability** | Each CPO must publish OCPI under the Public Charge Point Regulations 2023, but there is **no single aggregated open endpoint**. London Datastore / LOTI feeds are not public live. | partial | varies | L | Not recommended now |
| P | **Speed / red-light cameras, taxi ranks, coach parks, cycle parks** | TfL `/Place/Type/...` | static | no | S | Optional extra |

---

## 5. Things London does *not* have openly (omitted)

- Per-link live road speeds on TfL / borough roads (SCOOT and journey-time ANPR data are not published).
- Journey-time roadside signs (HK's harbour-minutes feature).
- Land-border, airport or Eurostar queue times.
- Smart-lamppost detectors.
- Live public car-park vacancy (TfL endpoint broken, nothing else open).
- Ferry "frequency" CSVs like the Star Ferry's.

---

## 6. Open decisions

1. **Road speed layer**: corridor status only (open, no key), or also National Highways NTIS motorway speeds (registration + push endpoint), or a commercial flow API?
2. **Harbour minutes → Thames crossings**: accept a status-only strip (no minutes)?
3. **Which §4 extras** to include in the first port (recommended: A, B, C, D, E, H, J, K)?
4. **Street Manager / NTIS / AIS** all need a server-side receiver (webhook or WebSocket). Is staying on Cloudflare Workers (+ Durable Objects / KV / D1) OK?
5. **Languages**: English only, or keep the i18n framework (e.g. for adding more languages later)?
6. **Hosting and branding**: your own Cloudflare account, the name "SmartLDN", what to do with the visit counter, and keeping the original MIT credit.
7. **Geographic extent**: the 32 boroughs + City (Greater London boundary), or also the M25 ring / Dartford?
8. **API keys**: you would register for the TfL app key (raises rate limits from ~50/min anonymous), plus BODS, Met Office DataHub and Rail Data Marketplace as chosen. I cannot create accounts.

---

## 7. Decisions (2026-10-05)

1. Roads: **TfL corridor status only** (Good→green, Serious→amber, Severe/Closure→red). No NTIS, no commercial flow.
2. Extras approved: **A** line status, **D** crowding, **E** lifts, **B** BODS bus positions, **C** Santander Cycles (replaces parking), **H** planning applications, **G** Street Manager works, **J** EA flood, **I** air quality (LAQN), **K** CCZ/ULEZ zones.
3. Language: **English only**. Chinese conversion and TC/SC fields removed.
4. Hosting: **owner's own Cloudflare account** (Workers + KV/D1/Durable Objects as needed). The visit counter is re-pointed to the owner's bindings or removed.
5. Header harbour minutes → Thames crossings status strip (default, not objected to).

---

## Sources

- TfL Unified API: https://api.tfl.gov.uk/ · Tech Forum (API retirements): https://techforum.tfl.gov.uk/t/unified-api-tidy-up/6296
- TfL buses on BODS: https://techforum.tfl.gov.uk/t/dft-bus-open-data/1554 · BODS: https://en.wikipedia.org/wiki/Bus_Open_Data_Service
- National Highways Data Lab: https://nationalhighways.co.uk/our-work/digital-lab/data-lab/ · NTIS DATEX II: https://www.trafficengland.com/resources/cms-docs/overview.pdf · WebTRIS: https://webtris.highwaysengland.co.uk/api/swagger/ui/index
- Street Manager open data: https://department-for-transport-streetmanager.github.io/street-manager-docs/open-data/
- Met Office DataHub observations: https://datahub.metoffice.gov.uk/pricing/observations
- Environment Agency flood monitoring API: https://environment.data.gov.uk/flood-monitoring/doc/reference
- Rail Data Marketplace / Darwin: https://www.nationalrail.co.uk/developers/darwin-data-feeds/
- LAQN API: https://api.erg.ic.ac.uk/AirQuality/help · Breathe London developers: https://www.breathelondon.org/developers
- GLA Planning London Datahub: https://www.london.gov.uk/programmes-strategies/planning/digital-planning/planning-london-datahub
- ULEZ boundary: https://data.london.gov.uk/dataset/london-wide-ultra-low-emission-zone-2023-vd455 · TfL Live Traffic Disruptions: https://data.london.gov.uk/dataset/tfl-live-traffic-disruptions-248xn/
- Borough parking bays (static): https://data.london.gov.uk/dataset/london-borough-of-southwark-parking-bays/
- EV charge point data (LOTI): https://loti.london/projects/ev-charge-points/ · OCPI regulation summary: https://www.chargepoint.com/en-gb/blog/navigating-uk-public-charging-regulations-guide-charge-point-operators
- aisstream.io: https://aisstream.io/documentation · Lime GBFS: https://www.li.me/about/partners/transit-portal
