import type { ExpressionSpecification, FilterSpecification, Map } from "maplibre-gl"
import chargeZones from "../../data/charge-zones.json"
import { cameraCone, incidentMark } from "@/components/map-icons"
import { BUS_MIN_ZOOM, STOP_MIN_ZOOM } from "@/lib/map-view"
import { stationCollection, trackCollection, type RailMode } from "@/lib/rail-network"
import { CHARGE_POINTS } from "@/lib/crossings"
import type { WatchLayer } from "@/lib/types"

export const LABEL_MIN_ZOOM = 16
export const RAIL_MODES: readonly RailMode[] = ["rail", "light", "river"]

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }

// Clicks on these open a card. The road line underneath yields to them. The
// charging zones are not listed: their fill covers central London and would
// swallow every click meant for a station or a stop.
export const WATCH_HITS = [
  "incidents",
  "works",
  "cameras",
  "charge-points",
  ...RAIL_MODES.flatMap((mode) => [`${mode}-stations`, `${mode}-station-label`, `${mode}-trains`, `${mode}-train-label`]),
  "bus-stops",
  "bus-stop-label",
  "bus-vehicles",
  "bus-vehicle-label",
  "cycles",
  "planning",
  "air",
]

const MODE_STYLE: Record<RailMode, { station: string; ring: string; credit: string; minzoom: number }> = {
  rail: { station: "#f7fbff", ring: "#041018", credit: "© Transport for London", minzoom: 0 },
  light: { station: "#e6fffb", ring: "#00626a", credit: "© Transport for London", minzoom: 10 },
  river: { station: "#e0f2fe", ring: "#0369a1", credit: "© Transport for London", minzoom: 10 },
}

export function layerIds(kind: WatchLayer): string[] {
  switch (kind) {
    case "roads":
      return ["corridor-glow", "corridor-casing", "corridor-line", "traffic-particles"]
    case "cameras":
      return ["cameras"]
    case "works":
      return ["works"]
    case "incidents":
      return ["incidents"]
    case "charges":
      return ["charge-zone-fill", "charge-zone-line", "charge-points"]
    case "rail":
    case "light":
    case "river":
      return [`${kind}-track-casing`, `${kind}-track`, `${kind}-stations`, `${kind}-station-label`, `${kind}-trains`, `${kind}-train-label`]
    case "bus":
      return ["bus-trip-route", "bus-trip-stops", "bus-stops", "bus-stop-label", "bus-vehicles", "bus-vehicle-label"]
    case "cycles":
      return ["cycles"]
    case "planning":
      return ["planning"]
    case "air":
      return ["air"]
    default: {
      const exhaustive: never = kind
      return exhaustive
    }
  }
}

export function mountDataLayers(map: Map) {
  map.addSource("corridors", { type: "geojson", data: EMPTY, attribution: "© Transport for London | © OpenStreetMap" })
  map.addSource("particles", { type: "geojson", data: EMPTY })
  map.addSource("cameras", { type: "geojson", data: EMPTY })
  map.addSource("works", { type: "geojson", data: EMPTY })
  map.addSource("incidents", { type: "geojson", data: EMPTY })
  map.addSource("charge-zones", { type: "geojson", data: chargeZones as GeoJSON.FeatureCollection, attribution: "© Greater London Authority" })
  map.addSource("charge-points", { type: "geojson", data: CHARGE_POINTS })
  map.addSource("warning-areas", { type: "geojson", data: EMPTY, attribution: "© Met Office" })
  for (const mode of RAIL_MODES) {
    map.addSource(`${mode}-track`, { type: "geojson", data: trackCollection(mode), attribution: MODE_STYLE[mode].credit })
    map.addSource(`${mode}-stations`, { type: "geojson", data: stationCollection(mode) })
    map.addSource(`${mode}-trains`, { type: "geojson", data: EMPTY })
    map.addSource(`${mode}-train-labels`, { type: "geojson", data: EMPTY })
  }
  map.addSource("bus-stops", { type: "geojson", data: EMPTY })
  map.addSource("bus-vehicles", { type: "geojson", data: EMPTY, attribution: "© Bus Open Data Service (DfT)" })
  map.addSource("bus-trip", { type: "geojson", data: EMPTY })
  map.addSource("bus-vehicle-labels", { type: "geojson", data: EMPTY })
  map.addSource("cycles", { type: "geojson", data: EMPTY })
  map.addSource("planning", { type: "geojson", data: EMPTY, attribution: "© Greater London Authority" })
  map.addSource("air", { type: "geojson", data: EMPTY, attribution: "© Imperial College London" })
  const before = overlaySlot(map)
  addWarningLayers(map, before)
  addChargeLayers(map, before)
  addRoadLayers(map, before)
  addPointLayers(map, before)
  for (const mode of RAIL_MODES) addRailLayers(map, mode, before)
}

function addRoadLayers(map: Map, before: string | undefined) {
  addOverlay(map, {
    id: "corridor-glow",
    type: "line",
    source: "corridors",
    paint: {
      "line-color": ["get", "color"],
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 7, 13, 12, 15, 16],
      "line-opacity": 0.3,
      "line-blur": 4,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  }, before)
  addOverlay(map, {
    id: "corridor-casing",
    type: "line",
    source: "corridors",
    paint: {
      "line-color": "#041018",
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 3.2, 13, 4.6, 15, 6.5],
      "line-opacity": 0.45,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  }, before)
  addOverlay(map, {
    id: "corridor-line",
    type: "line",
    source: "corridors",
    paint: {
      "line-color": ["get", "color"],
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 13, 2.4, 15, 3.4],
      "line-opacity": 0.95,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  }, before)
  addOverlay(map, {
    id: "traffic-particles",
    type: "circle",
    source: "particles",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.2, 13, 3.6],
      "circle-color": "#f4fff8",
      "circle-stroke-color": ["get", "color"],
      "circle-stroke-width": 1.6,
      "circle-pitch-alignment": "map",
    },
  }, before)
}

// Met Office warning areas are always drawn: they are rare and they matter.
// Like the charging zones they take no clicks; the Intel panel holds the detail.
function addWarningLayers(map: Map, before: string | undefined) {
  const colour: ExpressionSpecification = ["match", ["get", "level"], "red", "#FF3B4E", "amber", "#FF9F1C", "#FFD60A"]
  addOverlay(map, {
    id: "warning-area-fill",
    type: "fill",
    source: "warning-areas",
    paint: { "fill-color": colour, "fill-opacity": 0.12 },
  }, before)
  addOverlay(map, {
    id: "warning-area-line",
    type: "line",
    source: "warning-areas",
    paint: { "line-color": colour, "line-width": 2, "line-opacity": 0.85 },
  }, before)
}

function addChargeLayers(map: Map, before: string | undefined) {
  addOverlay(map, {
    id: "charge-zone-fill",
    type: "fill",
    source: "charge-zones",
    filter: ["==", ["get", "id"], "ccz"],
    paint: { "fill-color": "#FFC857", "fill-opacity": 0.06 },
  }, before)
  addOverlay(map, {
    id: "charge-zone-line",
    type: "line",
    source: "charge-zones",
    paint: {
      "line-color": ["match", ["get", "id"], "ccz", "#FFC857", "#D7B4FF"],
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1, 14, 2.4],
      "line-opacity": 0.75,
      "line-dasharray": [3, 2],
    },
  }, before)
  addOverlay(map, {
    id: "charge-points",
    type: "circle",
    source: "charge-points",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 5, 15, 10],
      "circle-color": "rgba(255, 200, 87, 0.2)",
      "circle-stroke-color": "#FFC857",
      "circle-stroke-width": 2,
      "circle-pitch-alignment": "map",
    },
  }, before)
}

function addPointLayers(map: Map, before: string | undefined) {
  const severity: FilterSpecification = ["any", ["==", ["get", "closure"], true], [">=", ["get", "rank"], 2]]
  addOverlay(map, {
    id: "works",
    type: "circle",
    source: "works",
    // Minimal works stay off the city view; they fill the map without changing a trip.
    filter: ["any", severity, [">=", ["zoom"], 13]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4.5, 14, 8],
      "circle-color": ["case", ["==", ["get", "closure"], true], "#FF5D73", [">=", ["get", "rank"], 3], "#FF5D73", [">=", ["get", "rank"], 2], "#FFC857", "#C9D2DC"],
      "circle-stroke-color": "#041018",
      "circle-stroke-width": 2,
      "circle-pitch-alignment": "map",
    },
  }, before)
  const mark = incidentMark()
  if (mark && !map.hasImage("incident-mark")) map.addImage("incident-mark", mark, { pixelRatio: 2 })
  if (map.hasImage("incident-mark")) {
    addOverlay(map, {
      id: "incidents",
      type: "symbol",
      source: "incidents",
      layout: {
        "icon-image": "incident-mark",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 10, ["case", severity, 0.72, 0.45], 14, ["case", severity, 1.05, 0.75]],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-pitch-alignment": "map",
        "icon-rotation-alignment": "map",
      },
    }, before)
  }
  const cone = cameraCone()
  if (cone && !map.hasImage("camera-cone")) map.addImage("camera-cone", cone, { pixelRatio: 2 })
  if (map.hasImage("camera-cone")) {
    addOverlay(map, {
      id: "cameras",
      type: "symbol",
      source: "cameras",
      minzoom: 12.5,
      layout: {
        "icon-image": "camera-cone",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 12.5, 0.42, 14, 0.85, 16, 1.05],
        "icon-rotate": ["coalesce", ["get", "rotation"], 0],
        "icon-rotation-alignment": "map",
        "icon-pitch-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    }, before)
  }
  addOverlay(map, {
    id: "bus-stops",
    type: "circle",
    source: "bus-stops",
    minzoom: STOP_MIN_ZOOM,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 3.5, 16, 6],
      "circle-color": "#f7fbff",
      "circle-stroke-color": "#DC241F",
      "circle-stroke-width": 1.5,
      "circle-pitch-alignment": "map",
    },
  }, before)
  addStopLabel(map, "bus-stop-label", "bus-stops", LABEL_MIN_ZOOM, false)
  // The route and next stops of the bus whose card is open.
  addOverlay(map, {
    id: "bus-trip-route",
    type: "line",
    source: "bus-trip",
    filter: ["==", ["get", "kind"], "route"],
    paint: { "line-color": "#DC241F", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3, 16, 6], "line-opacity": 0.55 },
    layout: { "line-cap": "round", "line-join": "round" },
  }, before)
  addOverlay(map, {
    id: "bus-trip-stops",
    type: "circle",
    source: "bus-trip",
    filter: ["==", ["get", "kind"], "stop"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 4, 16, 7],
      "circle-color": "#ffffff",
      "circle-stroke-color": "#DC241F",
      "circle-stroke-width": 2.5,
      "circle-pitch-alignment": "map",
    },
  }, before)
  addOverlay(map, {
    id: "bus-vehicles",
    type: "circle",
    source: "bus-vehicles",
    minzoom: BUS_MIN_ZOOM,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2.4, 15, 4.5, 17, 6.5],
      "circle-color": ["case", ["==", ["get", "operator"], "TFLO"], "#DC241F", "#F59E0B"],
      "circle-stroke-color": "#f7fbff",
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 12, 0.6, 16, 1.4],
      "circle-pitch-alignment": "map",
    },
  }, before)
  addStopLabel(map, "bus-vehicle-label", "bus-vehicle-labels", LABEL_MIN_ZOOM, false)
  addOverlay(map, {
    id: "cycles",
    type: "circle",
    source: "cycles",
    minzoom: 12.5,
    // Colour is availability, not the brand red: red already means trouble on this map.
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12.5, 2.2, 16, 5.5],
      "circle-color": ["case", ["==", ["get", "available"], 0], "#5C6B7A", ["<=", ["get", "available"], 2], "#FFC857", "#5EEAD4"],
      "circle-stroke-color": "#041018",
      "circle-stroke-width": 1,
      "circle-pitch-alignment": "map",
    },
  }, before)
  addOverlay(map, {
    id: "planning",
    type: "circle",
    source: "planning",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 3.5, 17, 7],
      "circle-color": ["match", ["get", "stage"], "building", "#F97316", "pending", "#7DD3E8", "#A3B1BF"],
      "circle-stroke-color": "#041018",
      "circle-stroke-width": 1.5,
      "circle-pitch-alignment": "map",
    },
  }, before)
  addOverlay(map, {
    id: "air",
    type: "circle",
    source: "air",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 6, 14, 11],
      "circle-color": ["case", ["!", ["has", "index"]], "#5C6B7A", [">=", ["get", "index"], 10], "#C026D3", [">=", ["get", "index"], 7], "#FF5D73", [">=", ["get", "index"], 4], "#FFC857", "#3DDC97"],
      "circle-opacity": 0.85,
      "circle-stroke-color": "#041018",
      "circle-stroke-width": 1.5,
      "circle-pitch-alignment": "map",
    },
  }, before)
}

function addRailLayers(map: Map, mode: RailMode, before: string | undefined) {
  const style = MODE_STYLE[mode]
  const river = mode === "river"
  addOverlay(map, {
    id: `${mode}-track-casing`,
    type: "line",
    source: `${mode}-track`,
    minzoom: style.minzoom,
    paint: {
      "line-color": "#041018",
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 3.2, 14, 5],
      "line-opacity": river ? 0 : 0.55,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  }, before)
  addOverlay(map, {
    id: `${mode}-track`,
    type: "line",
    source: `${mode}-track`,
    minzoom: style.minzoom,
    paint: {
      "line-color": ["get", "color"],
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.6, 14, 2.6],
      "line-opacity": river ? 0.5 : 0.92,
      ...(river ? { "line-dasharray": [2, 2] } : {}),
    },
    layout: { "line-cap": "round", "line-join": "round" },
  }, before)
  addOverlay(map, {
    id: `${mode}-stations`,
    type: "circle",
    source: `${mode}-stations`,
    minzoom: mode === "rail" ? 10.5 : 11.5,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 14, 5.5],
      "circle-color": style.station,
      "circle-stroke-color": style.ring,
      "circle-stroke-width": 1.5,
      "circle-pitch-alignment": "map",
    },
  }, before)
  addStopLabel(map, `${mode}-station-label`, `${mode}-stations`)
  addOverlay(map, {
    id: `${mode}-trains`,
    type: "circle",
    source: `${mode}-trains`,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, river ? 4.5 : 3.5, 14, 7],
      "circle-color": ["get", "color"],
      "circle-stroke-color": "#f7fbff",
      "circle-stroke-width": 1.5,
      "circle-pitch-alignment": "map",
    },
  }, before)
  addStopLabel(map, `${mode}-train-label`, `${mode}-train-labels`)
}

function overlaySlot(map: Map): string | undefined {
  // Style labels stay above the data. On Liberty the first label is also below
  // the extruded buildings, so those roofs still cover the markers.
  const layers = map.getStyle()?.layers
  if (!layers) return undefined
  return layers.find((layer) => layer.type === "symbol")?.id
}

function addOverlay(map: Map, layer: Parameters<Map["addLayer"]>[0], before: string | undefined) {
  if (before && map.getLayer(before)) map.addLayer(layer, before)
  else map.addLayer(layer)
}

// Plates go on top of the whole style. Below the basemap's labels they lose every
// collision on Streets and Buildings, where street names and shop labels sit.
function addStopLabel(map: Map, id: string, source: string, minzoom = LABEL_MIN_ZOOM, allowOverlap = true) {
  map.addLayer({
    id,
    type: "symbol",
    source,
    minzoom,
    filter: ["has", "icon"],
    layout: {
      "icon-image": ["get", "icon"],
      "icon-anchor": "bottom",
      "icon-offset": [0, -10],
      "icon-allow-overlap": allowOverlap,
      "icon-ignore-placement": allowOverlap,
      "icon-pitch-alignment": "viewport",
      "icon-rotation-alignment": "viewport",
    },
  })
}
