"use client"

import { useEffect, useRef, useState, type MutableRefObject } from "react"
import {
  GeoJSONSource,
  GPUInitializationError,
  Map,
  NavigationControl,
  setWorkerUrl,
  type ErrorEvent,
  type LngLat,
  type MapGeoJSONFeature,
  type MapMouseEvent,
  type StyleSpecification,
} from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { useI18n } from "@/components/locale"
import {
  airPopup,
  busStopPopup,
  busVehiclePopup,
  cameraPopup,
  chargePopup,
  corridorPopup,
  cyclePopup,
  disruptionPopup,
  planningPopup,
  stationPopup,
  trainPopup,
  type TransitContext,
} from "@/components/map-cards"
import { placeStopPlate } from "@/components/map-icons"
import { LABEL_MIN_ZOOM, RAIL_MODES, WATCH_HITS, layerIds, mountDataLayers } from "@/components/map-layers"
import { holdDataCreditOpen, openFeature, popupOpener } from "@/components/map-popup"
import { BUS_MIN_ZOOM, mapViewKey, placePinZoom, type MapView } from "@/lib/map-view"
import { busMotionCollection, busPosition, noBusMotion, syncBusMotion, type BusMotions } from "@/lib/bus-motion"
import { soleLayer } from "@/lib/preferences"
import type { Messages } from "@/lib/i18n"
import { lineRecord, linesThrough, stationCollection, stationPoint, stationRecord, type RailMode } from "@/lib/rail-network"
import { beginPush, endPush, type PushGate } from "@/lib/frame-push"
import { advanceRuns, mergeRuns, runCollection, runsFromTrains, type TrainRun } from "@/lib/train-run"
import type { AirSite, Basemap, BusResponse, BusVehicle, Corridor, CycleDock, PlanningApp, RailResponse, SpeedBand, WatchLayer, WatchLayers } from "@/lib/types"

// Turbopack rewrites MapLibre's own worker URL into a chunk the worker cannot run.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")

const BAND_COLOR: Record<SpeedBand, string> = {
  free: "#3DDC97",
  slow: "#FFC857",
  congested: "#FF5D73",
  unknown: "#C9D2DC",
}

// TfL publishes no speed, so the moving dots only show the status: a Good
// corridor flows, a Serious one crawls, a Severe one barely moves.
const BAND_PACE: Record<SpeedBand, number> = { free: 50, slow: 22, congested: 8, unknown: 0 }

const CENTRE: [number, number] = [-0.1, 51.508]

const OPENING = {
  center: CENTRE,
  zoom: 11.4,
  pitch: 55,
  bearing: -12,
}

const LABEL_REFRESH_MS = 700
// Buses move a few metres a second, so five redraws a second look smooth.
const BUS_FRAME_MS = 200
const BUS_LABEL_CAP = 60

const FLYOVER = [
  { center: [-0.1246, 51.5007] as [number, number], zoom: 13.4, pitch: 60, bearing: -20, duration: 7000, curve: 1.25 },
  { center: [-0.0865, 51.5115] as [number, number], zoom: 13.6, pitch: 58, bearing: 15, duration: 7400, curve: 1.25 },
  { center: [-0.0195, 51.5045] as [number, number], zoom: 13.2, pitch: 55, bearing: -8, duration: 7200, curve: 1.2 },
  { center: [0.002, 51.5035] as [number, number], zoom: 13, pitch: 52, bearing: 20, duration: 7200, curve: 1.2 },
]

function narrowScreen(): boolean {
  return window.matchMedia("(max-width: 760px)").matches
}

function iosWebKit(): boolean {
  const agent = navigator.userAgent
  const touchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
  return /iPhone|iPad|iPod/.test(agent) || touchMac
}

function mapPixelRatio(): number {
  const ratio = window.devicePixelRatio || 1
  if (narrowScreen()) return Math.min(ratio, 2)
  return ratio
}

// OSM Bright and OSM Liberty, served by OpenFreeMap against its planet tiles.
const STREET_STYLE = "https://tiles.openfreemap.org/styles/bright"
const BUILDINGS_STYLE = "https://tiles.openfreemap.org/styles/liberty"

function satelliteStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      imagery: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        // Esri's picture is 256 px. A 512 px tile stretches it and the phone keeps the coarser zoom.
        tileSize: 256,
        // Zoom 20 and above is often Esri's gray "Map Data Not Yet Available" tile.
        maxzoom: 19,
        attribution: "© Esri",
      },
      labels: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
      },
    },
    layers: [
      { id: "satellite", type: "raster", source: "imagery", paint: { "raster-fade-duration": 0 } },
      { id: "places", type: "raster", source: "labels", paint: { "raster-fade-duration": 0, "raster-opacity": 0.88 } },
    ],
  }
}

function basemapStyle(basemap: Basemap): string | StyleSpecification {
  switch (basemap) {
    case "street":
      return STREET_STYLE
    case "buildings":
      return BUILDINGS_STYLE
    case "satellite":
      return satelliteStyle()
    default: {
      const exhaustive: never = basemap
      return exhaustive
    }
  }
}

function basemapCamera(map: Map, basemap: Basemap): { pitch: number; bearing: number; zoom?: number; duration: number } {
  const phone = narrowScreen()
  switch (basemap) {
    case "street":
      return { pitch: 0, bearing: 0, duration: phone ? 200 : 650 }
    case "satellite":
      return { pitch: OPENING.pitch, bearing: OPENING.bearing, duration: phone ? 200 : 650 }
    case "buildings":
      return {
        pitch: phone ? 46 : 64,
        bearing: -18,
        zoom: Math.max(map.getZoom(), phone ? 14.05 : 15.4),
        duration: phone ? 200 : 800,
      }
    default: {
      const exhaustive: never = basemap
      return exhaustive
    }
  }
}

function tourCamera(step: (typeof FLYOVER)[number], basemap: Basemap) {
  switch (basemap) {
    case "street":
      return { ...step, pitch: 0, bearing: 0 }
    case "satellite":
      return step
    case "buildings":
      return { ...step, zoom: Math.max(step.zoom, 15.2), pitch: Math.max(step.pitch, 60) }
    default: {
      const exhaustive: never = basemap
      return exhaustive
    }
  }
}

type AnimLine = {
  coords: [number, number][]
  cum: number[]
  band: SpeedBand
  pace: number
}

type Particle = { line: number; t: number }

type RailSnapshots = Record<RailMode, RailResponse | null>
type Runs = Record<RailMode, TrainRun[]>

type CityMapProps = {
  corridors: Corridor[]
  cameras: GeoJSON.FeatureCollection | null
  works: GeoJSON.FeatureCollection | null
  incidents: GeoJSON.FeatureCollection | null
  rail: RailSnapshots
  transit: TransitContext
  bus: BusResponse | null
  buses: BusVehicle[] | null
  cycles: CycleDock[] | null
  planning: PlanningApp[] | null
  air: AirSite[] | null
  onView: (view: MapView) => void
  layers: WatchLayers
  basemap: Basemap
  flyToken: number
  focus: { id: string; coordinates: [number, number] } | null
  onMap: (available: boolean) => void
  disabled?: boolean
}

const ALL_LAYERS: WatchLayer[] = ["roads", "cameras", "works", "incidents", "charges", "rail", "light", "bus", "river", "cycles", "planning", "air"]

export function CityMap({
  corridors,
  cameras,
  works,
  incidents,
  rail,
  transit,
  bus,
  buses,
  cycles,
  planning,
  air,
  onView,
  layers,
  basemap,
  flyToken,
  focus,
  onMap,
  disabled = false,
}: CityMapProps) {
  const { messages } = useI18n()
  const copyRef = useRef(messages)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const linesRef = useRef<AnimLine[]>([])
  const particlesRef = useRef<Particle[]>([])
  const corridorsRef = useRef(corridors)
  const railRef = useRef<RailSnapshots>(rail)
  const runsRef = useRef<Runs>({ rail: [], light: [], river: [] })
  const transitRef = useRef(transit)
  const busMotionRef = useRef<BusMotions>(noBusMotion())
  const onMapRef = useRef(onMap)
  const onViewRef = useRef(onView)
  const readyRef = useRef(false)
  const basemapRef = useRef(basemap)
  const cancelFlyRef = useRef<(() => void) | null>(null)
  const closeCardRef = useRef<(() => void) | null>(null)
  const viewKeyRef = useRef<string | null>(null)
  const appliedBasemap = useRef<Basemap | null>(null)
  const restoreOverlaysRef = useRef<(() => void) | null>(null)
  const styleToken = useRef(0)
  const [mapReady, setMapReady] = useState(false)
  const [styleEpoch, setStyleEpoch] = useState(0)
  const [gpuFailed, setGpuFailed] = useState(false)
  const [wasDisabled, setWasDisabled] = useState(disabled)
  if (disabled !== wasDisabled) {
    setWasDisabled(disabled)
    if (!disabled) setGpuFailed(false)
  }
  const unavailable = disabled || gpuFailed

  useEffect(() => {
    transitRef.current = transit
  }, [transit])

  useEffect(() => {
    corridorsRef.current = corridors
    const map = mapRef.current
    if (!map || !readyRef.current) return
    publishCorridors(map, corridors, linesRef, particlesRef)
  }, [corridors, styleEpoch])

  useEffect(() => {
    onMapRef.current = onMap
  }, [onMap])

  useEffect(() => {
    onViewRef.current = onView
  }, [onView])

  useEffect(() => {
    const map = mapRef.current
    if (disabled || !map || !mapReady) return
    let settle = 0
    const report = () => {
      window.clearTimeout(settle)
      settle = window.setTimeout(() => {
        const centre = map.getCenter()
        const zoom = map.getZoom()
        const key = mapViewKey(centre.lng, centre.lat, zoom)
        if (viewKeyRef.current === key) return
        viewKeyRef.current = key
        const box = map.getBounds()
        onViewRef.current({ lng: centre.lng, lat: centre.lat, zoom, bounds: [box.getWest(), box.getSouth(), box.getEast(), box.getNorth()] })
      }, 800)
    }
    report()
    map.on("moveend", report)
    return () => {
      window.clearTimeout(settle)
      map.off("moveend", report)
    }
  }, [disabled, mapReady])

  useEffect(() => {
    railRef.current = rail
    const now = Date.now()
    const next: Runs = { rail: [], light: [], river: [] }
    for (const mode of RAIL_MODES) {
      const snapshot = rail[mode]
      next[mode] = snapshot?.ok
        ? mergeRuns(runsRef.current[mode], runsFromTrains(snapshot.trains, stationPoint, (line) => lineRecord(line)?.color ?? "#7DD3E8", now), now)
        : []
    }
    runsRef.current = next
  }, [rail])

  useEffect(() => {
    busMotionRef.current = buses && layers.bus ? syncBusMotion(busMotionRef.current, buses, Date.now()) : noBusMotion()
  }, [buses, layers.bus])

  useEffect(() => {
    basemapRef.current = basemap
  }, [basemap])

  useEffect(() => {
    onMapRef.current(!unavailable)
  }, [unavailable])

  useEffect(() => {
    if (disabled) return
    const container = containerRef.current
    if (!container) return

    let active = true
    let map: Map
    try {
      map = new Map({
        container,
        pixelRatio: mapPixelRatio(),
        attributionControl: { compact: true },
        maxPitch: 72,
        maxBounds: [
          [-0.8, 51.2],
          [0.6, 51.8],
        ],
        style: satelliteStyle(),
        ...OPENING,
      })
    } catch (error) {
      if (!isGpuFailure(error)) throw error
      queueMicrotask(() => {
        if (active) setGpuFailed(true)
      })
      return () => {
        active = false
      }
    }
    map.addControl(new NavigationControl({ visualizePitch: true }), "top-left")
    mapRef.current = map
    holdDataCreditOpen(map)

    let removed = false
    const dropMap = () => {
      if (removed) return
      removed = true
      readyRef.current = false
      mapRef.current = null
      setMapReady(false)
      setGpuFailed(true)
      map.remove()
    }
    map.on("error", (event: ErrorEvent) => {
      if (isGpuFailure(event.error)) dropMap()
    })

    const cards = popupOpener(map)
    closeCardRef.current = cards.close
    const restoreOverlays = () => {
      mountDataLayers(map)
      bindOverlayClicks(map, cards.show, copyRef, railRef, transitRef)
      holdDataCreditOpen(map)
    }
    restoreOverlaysRef.current = restoreOverlays

    map.on("load", () => {
      map.resize()
      restoreOverlays()
      readyRef.current = true
      setMapReady(true)
      publishCorridors(map, corridorsRef.current, linesRef, particlesRef)
    })

    let frame = 0
    let last = performance.now()
    let drewParticles = false
    // iOS Safari stops requestAnimationFrame on a WebGL page it considers idle,
    // and a GeoJSON push every frame aborts the tile reload before the dot moves.
    const ios = iosWebKit()
    const pushGap = ios ? 140 : 0
    const gates: Record<"particles" | "buses" | RailMode, PushGate> = {
      particles: { busy: false, at: 0 },
      buses: { busy: false, at: 0 },
      rail: { busy: false, at: 0 },
      light: { busy: false, at: 0 },
      river: { busy: false, at: 0 },
    }
    let keep: HTMLDivElement | null = null
    if (ios) {
      keep = document.createElement("div")
      keep.setAttribute("aria-hidden", "true")
      keep.className = "ios-frame-keep"
      document.body.appendChild(keep)
    }
    const labelled: Record<RailMode, boolean> = { rail: false, light: false, river: false }
    let busesAt = 0
    let drewBuses = false
    let busLabelsDrawn = false
    let busLabelsAt = 0
    let labelsAt = 0
    const refreshTrainLabels = (current: Map, now: number) => {
      const show = current.getZoom() >= LABEL_MIN_ZOOM
      if (!show) {
        for (const mode of RAIL_MODES) {
          if (!labelled[mode]) continue
          geoJsonSource(current, `${mode}-train-labels`)?.setData(emptyCollection())
          labelled[mode] = false
        }
        return
      }
      if (now - labelsAt < LABEL_REFRESH_MS && RAIL_MODES.some((mode) => labelled[mode])) return
      labelsAt = now
      for (const mode of RAIL_MODES) {
        const source = geoJsonSource(current, `${mode}-train-labels`)
        if (!source) continue
        if (!layerShown(current, `${mode}-train-label`)) {
          if (labelled[mode]) source.setData(emptyCollection())
          labelled[mode] = false
          continue
        }
        source.setData(withTrainMarks(current, runCollection(runsRef.current[mode], stationPoint), copyRef.current))
        labelled[mode] = true
      }
    }
    const step = () => {
      const now = performance.now()
      const elapsed = Math.max(0, (now - last) / 1000)
      last = now
      const dt = Math.min(0.05, elapsed)
      const current = mapRef.current
      if (!current || !readyRef.current || document.hidden) return
      const particles = geoJsonSource(current, "particles")
      const particlesMoving = layerShown(current, "traffic-particles") && linesRef.current.length > 0 && particlesRef.current.length > 0
      if (particles && particlesMoving) {
        const moving = particleCollection(linesRef.current, particlesRef.current, dt)
        if (ios) pushMovingSource(particles, gates.particles, moving, now, pushGap)
        else particles.setData(moving)
        drewParticles = true
      } else if (particles && drewParticles) {
        particles.setData(emptyCollection())
        drewParticles = false
      }
      const trainStep = Math.min(1, elapsed)
      for (const mode of RAIL_MODES) {
        const trains = geoJsonSource(current, `${mode}-trains`)
        if (!trains || !layerShown(current, `${mode}-trains`)) continue
        runsRef.current = { ...runsRef.current, [mode]: advanceRuns(runsRef.current[mode], trainStep, stationPoint) }
        const moving = runCollection(runsRef.current[mode], stationPoint)
        if (ios) pushMovingSource(trains, gates[mode], moving, now, pushGap)
        else trains.setData(moving)
      }
      refreshTrainLabels(current, now)
      if (now - busesAt >= BUS_FRAME_MS) {
        busesAt = now
        const vehicles = geoJsonSource(current, "bus-vehicles")
        const motions = busMotionRef.current
        const showing = layerShown(current, "bus-vehicles") && current.getZoom() >= BUS_MIN_ZOOM && motions.size > 0
        if (vehicles && showing) {
          const moving = busMotionCollection(motions, Date.now())
          if (ios) pushMovingSource(vehicles, gates.buses, moving, now, pushGap)
          else vehicles.setData(moving)
          drewBuses = true
        } else if (vehicles && drewBuses) {
          vehicles.setData(emptyCollection())
          drewBuses = false
        }
        const labels = geoJsonSource(current, "bus-vehicle-labels")
        const plated = showing && current.getZoom() >= LABEL_MIN_ZOOM
        if (labels && plated && now - busLabelsAt >= LABEL_REFRESH_MS) {
          busLabelsAt = now
          labels.setData(busPlates(current, motions, copyRef.current))
          busLabelsDrawn = true
        } else if (labels && busLabelsDrawn && !plated) {
          labels.setData(emptyCollection())
          busLabelsDrawn = false
        }
      }
    }
    const tick = () => {
      step()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const pulse = ios ? window.setInterval(step, 140) : 0

    return () => {
      active = false
      cancelAnimationFrame(frame)
      if (pulse) window.clearInterval(pulse)
      keep?.remove()
      readyRef.current = false
      if (!removed) {
        removed = true
        map.remove()
      }
      mapRef.current = null
      restoreOverlaysRef.current = null
      closeCardRef.current = null
    }
  }, [disabled])

  useEffect(() => {
    const map = mapRef.current
    if (disabled || !map || !mapReady) return
    let cancelled = false
    const cancel = () => {
      cancelled = true
    }
    cancelFlyRef.current = cancel
    const start = window.setTimeout(() => {
      if (cancelled) return
      const automatic = flyToken === 0
      if (automatic && (narrowScreen() || window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return
      let index = 0
      const run = () => {
        if (cancelled || index >= FLYOVER.length) return
        const next = FLYOVER[index]
        index += 1
        if (!next) return
        map.flyTo({ ...tourCamera(next, basemapRef.current), essential: true })
        map.once("moveend", run)
      }
      run()
    }, 700)
    return () => {
      cancel()
      if (cancelFlyRef.current === cancel) cancelFlyRef.current = null
      window.clearTimeout(start)
      if (mapRef.current === map) map.stop()
    }
  }, [disabled, flyToken, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!focus || disabled || !map || !mapReady) return
    cancelFlyRef.current?.()
    closeCardRef.current?.()
    map.stop()
    map.flyTo({
      center: focus.coordinates,
      zoom: Math.max(map.getZoom(), basemapRef.current === "buildings" && !narrowScreen() ? 15.6 : 14.2),
      duration: narrowScreen() ? 250 : 900,
      essential: true,
    })
  }, [disabled, focus, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady) {
      appliedBasemap.current = null
      return
    }
    if (disabled || !map) return
    if (appliedBasemap.current === basemap) return
    const first = appliedBasemap.current === null
    appliedBasemap.current = basemap
    if (first && basemap === "satellite") return
    cancelFlyRef.current?.()
    readyRef.current = false
    const token = styleToken.current + 1
    styleToken.current = token
    map.setStyle(basemapStyle(basemap), { diff: false })
    map.once("style.load", () => {
      if (token !== styleToken.current || mapRef.current !== map) return
      restoreOverlaysRef.current?.()
      readyRef.current = true
      map.easeTo({ ...basemapCamera(map, basemap), essential: true })
      setStyleEpoch((epoch) => epoch + 1)
    })
  }, [basemap, disabled, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (disabled || !map || !mapReady) return
    const paint = () => {
      const labels = map.getZoom() >= LABEL_MIN_ZOOM
      geoJsonSource(map, "cameras")?.setData(cameras ?? emptyCollection())
      geoJsonSource(map, "works")?.setData(works ?? emptyCollection())
      geoJsonSource(map, "incidents")?.setData(incidents ?? emptyCollection())
      for (const mode of RAIL_MODES) {
        if (rail[mode]?.ok) continue
        geoJsonSource(map, `${mode}-trains`)?.setData(emptyCollection())
        geoJsonSource(map, `${mode}-train-labels`)?.setData(emptyCollection())
      }
      geoJsonSource(map, "bus-stops")?.setData(layers.bus && bus?.ok ? busStopCollection(map, bus, labels) : emptyCollection())
      geoJsonSource(map, "cycles")?.setData(layers.cycles && cycles ? cycleCollection(cycles) : emptyCollection())
      geoJsonSource(map, "planning")?.setData(layers.planning && planning ? planningCollection(planning) : emptyCollection())
      geoJsonSource(map, "air")?.setData(layers.air && air ? airCollection(air) : emptyCollection())
    }
    paint()
    map.on("zoomend", paint)
    return () => {
      map.off("zoomend", paint)
    }
  }, [air, bus, cameras, cycles, disabled, incidents, layers.air, layers.bus, layers.cycles, layers.planning, mapReady, planning, rail, styleEpoch, works])

  useEffect(() => {
    const map = mapRef.current
    if (disabled || !map || !mapReady) return
    const paint = () => {
      const labels = map.getZoom() >= LABEL_MIN_ZOOM
      for (const mode of RAIL_MODES) {
        geoJsonSource(map, `${mode}-stations`)?.setData(platedStations(map, stationCollection(mode), mode, labels))
      }
    }
    paint()
    map.on("zoomend", paint)
    return () => {
      map.off("zoomend", paint)
    }
  }, [disabled, mapReady, styleEpoch])

  useEffect(() => {
    const map = mapRef.current
    if (disabled || !map || !mapReady) return
    const sole = soleLayer(layers)
    const pinZoom: Partial<Record<string, number>> = {
      "bus-stops": placePinZoom("bus", sole),
      planning: placePinZoom("planning", sole),
    }
    for (const kind of ALL_LAYERS) {
      for (const layerId of layerIds(kind)) {
        if (!map.getLayer(layerId)) continue
        map.setLayoutProperty(layerId, "visibility", layers[kind] ? "visible" : "none")
        const min = pinZoom[layerId]
        if (min != null) map.setLayerZoomRange(layerId, min, 24)
      }
    }
  }, [disabled, layers, mapReady, styleEpoch])

  function basemapTitle(mode: Basemap): string {
    switch (mode) {
      case "street":
        return messages.openStreet
      case "satellite":
        return messages.satelliteMap
      case "buildings":
        return messages.buildingsMap
      default: {
        const exhaustive: never = mode
        return exhaustive
      }
    }
  }

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        aria-label={basemapTitle(basemap)}
      />
      {unavailable ? (
        <p className="pointer-events-none absolute inset-x-6 top-[28%] z-[1] max-w-md text-sm leading-relaxed text-zinc-300">
          {messages.mapFailed}
        </p>
      ) : null}
    </>
  )
}

function isGpuFailure(error: unknown): boolean {
  if (error instanceof GPUInitializationError) return true
  const message = error instanceof Error ? error.message : ""
  return /webgl|gpu initialization/i.test(message)
}

function withTrainMarks(map: Map, collection: GeoJSON.FeatureCollection, m: Messages): GeoJSON.FeatureCollection {
  for (const feature of collection.features) {
    const properties = feature.properties
    if (!properties) continue
    const dest = typeof properties.dest === "string" ? stationRecord(properties.dest)?.name ?? "" : ""
    const line = typeof properties.line === "string" ? lineRecord(properties.line)?.name ?? "" : ""
    const stroke = typeof properties.color === "string" && properties.color ? properties.color : "#f7fbff"
    const icon = placeStopPlate(map, dest ? m.towards(dest) : "", line ? [line] : [], stroke)
    if (icon) properties.icon = icon
  }
  return collection
}

// Route plates for the buses on screen, refreshed with the train plates.
function busPlates(map: Map, motions: BusMotions, m: Messages): GeoJSON.FeatureCollection {
  const bounds = map.getBounds()
  const features: GeoJSON.Feature[] = []
  const now = Date.now()
  for (const motion of motions.values()) {
    if (features.length >= BUS_LABEL_CAP) break
    const position = busPosition(motion, now)
    if (!bounds.contains(position)) continue
    const { vehicle } = motion
    const icon = placeStopPlate(map, vehicle.dest ? m.towards(vehicle.dest) : "", vehicle.route ? [vehicle.route] : [], "#DC241F")
    if (!icon) continue
    features.push({
      type: "Feature",
      properties: { id: vehicle.id, route: vehicle.route, dest: vehicle.dest, operator: vehicle.operator, at: vehicle.at, icon },
      geometry: { type: "Point", coordinates: position },
    })
  }
  return { type: "FeatureCollection", features }
}

function emptyCollection(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] }
}

function publishCorridors(map: Map, corridors: Corridor[], linesRef: MutableRefObject<AnimLine[]>, particlesRef: MutableRefObject<Particle[]>) {
  const source = geoJsonSource(map, "corridors")
  if (!source) return
  const features: GeoJSON.Feature[] = corridors
    .filter((corridor) => corridor.paths.length > 0)
    .map((corridor) => ({
      type: "Feature",
      properties: {
        name: corridor.name,
        status: corridor.status,
        detail: corridor.detail,
        band: corridor.band,
        closed: corridor.closed,
        color: BAND_COLOR[corridor.band],
      },
      geometry: { type: "MultiLineString", coordinates: corridor.paths },
    }))
  source.setData({ type: "FeatureCollection", features })

  const lines: AnimLine[] = []
  for (const corridor of corridors) {
    const pace = BAND_PACE[corridor.band]
    if (pace <= 0 || corridor.closed) continue
    for (const coords of corridor.paths) {
      if (coords.length < 2) continue
      const cum = [0]
      for (let index = 1; index < coords.length; index += 1) {
        const previous = coords[index - 1]
        const point = coords[index]
        if (!previous || !point) continue
        cum.push((cum[cum.length - 1] ?? 0) + Math.hypot((point[0] - previous[0]) * 69, (point[1] - previous[1]) * 111))
      }
      if ((cum[cum.length - 1] ?? 0) < 0.3) continue
      lines.push({ coords, cum, band: corridor.band, pace })
    }
  }
  linesRef.current = lines
  const particles: Particle[] = []
  const ranked = lines
    .map((line, lineIndex) => ({ line, lineIndex, distance: centreDistance(line.coords) }))
    .sort((a, b) => a.distance - b.distance)
  for (const entry of ranked) {
    const total = entry.line.cum[entry.line.cum.length - 1] ?? 0
    const count = Math.max(1, Math.min(3, Math.round(total / 1.5)))
    for (let index = 0; index < count && particles.length < 320; index += 1) {
      particles.push({ line: entry.lineIndex, t: (index + 0.15) / count })
    }
    if (particles.length >= 320) break
  }
  particlesRef.current = particles
}

function centreDistance(coords: [number, number][]): number {
  const mid = coords[Math.floor(coords.length / 2)]
  if (!mid) return 99
  return Math.hypot((mid[0] - CENTRE[0]) * 69, (mid[1] - CENTRE[1]) * 111)
}

function layerShown(map: Map, layerId: string): boolean {
  return Boolean(map.getLayer(layerId)) && map.getLayoutProperty(layerId, "visibility") !== "none"
}

function particleCollection(lines: AnimLine[], particles: Particle[], dt: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const particle of particles) {
    const line = lines[particle.line]
    if (!line) continue
    const total = line.cum[line.cum.length - 1] ?? 1
    // A dot covers the path at the band's pace, sped up so the motion reads on screen.
    particle.t = (particle.t + ((line.pace / 3600) * 40 * dt) / Math.max(0.3, total)) % 1
    features.push({
      type: "Feature",
      properties: { color: BAND_COLOR[line.band] },
      geometry: { type: "Point", coordinates: pointAlong(line, particle.t) },
    })
  }
  return { type: "FeatureCollection", features }
}

function pushMovingSource(source: GeoJSONSource, gate: PushGate, data: GeoJSON.FeatureCollection, now: number, gapMs: number): void {
  if (!source.loaded()) return
  if (!beginPush(gate, now, gapMs)) return
  try {
    source.setData(data).then(
      () => endPush(gate),
      () => endPush(gate),
    )
  } catch {
    endPush(gate)
  }
}

function pointAlong(line: AnimLine, t: number): [number, number] {
  const total = line.cum[line.cum.length - 1] ?? 0
  const first = line.coords[0]
  if (!first || total <= 0) return first ?? CENTRE
  const target = t * total
  let index = 1
  while (index < line.cum.length - 1 && (line.cum[index] ?? 0) < target) index += 1
  const start = line.cum[index - 1] ?? 0
  const end = line.cum[index] ?? start
  const mix = (target - start) / (end - start || 1)
  const a = line.coords[index - 1] ?? first
  const b = line.coords[index] ?? a
  return [a[0] + (b[0] - a[0]) * mix, a[1] + (b[1] - a[1]) * mix]
}

function geoJsonSource(map: Map, id: string): GeoJSONSource | null {
  const source = map.getSource(id)
  return source instanceof GeoJSONSource ? source : null
}

function bindOverlayClicks(
  map: Map,
  showPopup: (lngLat: LngLat, content: HTMLElement) => void,
  copyRef: MutableRefObject<Messages>,
  railRef: MutableRefObject<RailSnapshots>,
  transitRef: MutableRefObject<TransitContext>,
) {
  const watchLayers = WATCH_HITS.filter((layerId) => map.getLayer(layerId))
  map.on("click", "corridor-line", (event: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
    if (watchLayers.length > 0 && map.queryRenderedFeatures(event.point, { layers: watchLayers }).length > 0) return
    const feature = event.features?.[0]
    if (feature) showPopup(event.lngLat, corridorPopup(feature.properties ?? null, copyRef.current))
  })
  const popups: Record<string, (properties: GeoJSON.GeoJsonProperties) => HTMLElement> = {
    cameras: (properties) => cameraPopup(properties, copyRef.current),
    works: (properties) => disruptionPopup(properties, copyRef.current),
    incidents: (properties) => disruptionPopup(properties, copyRef.current),
    "charge-points": (properties) => chargePopup(properties, copyRef.current),
    "bus-stops": (properties) => busStopPopup(properties, copyRef.current),
    "bus-stop-label": (properties) => busStopPopup(properties, copyRef.current),
    "bus-vehicles": (properties) => busVehiclePopup(properties, copyRef.current),
    "bus-vehicle-label": (properties) => busVehiclePopup(properties, copyRef.current),
    cycles: (properties) => cyclePopup(properties, copyRef.current),
    planning: (properties) => planningPopup(properties, copyRef.current),
    air: (properties) => airPopup(properties, copyRef.current),
  }
  for (const mode of RAIL_MODES) {
    const station = (properties: GeoJSON.GeoJsonProperties) => stationPopup(properties, railRef.current[mode], transitRef.current, mode, copyRef.current)
    const train = (properties: GeoJSON.GeoJsonProperties) => trainPopup(properties, railRef.current[mode], mode, copyRef.current)
    popups[`${mode}-stations`] = station
    popups[`${mode}-station-label`] = station
    popups[`${mode}-trains`] = train
    popups[`${mode}-train-label`] = train
  }
  for (const layerId of watchLayers) {
    const render = popups[layerId]
    if (!render) continue
    map.on("click", layerId, (event) => openFeature(showPopup, event, render))
  }
  for (const layerId of ["corridor-line", ...watchLayers]) {
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer"
    })
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = ""
    })
  }
}

function busStopCollection(map: Map, board: BusResponse, labels: boolean): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: board.stops.map((stop) => {
      const title = stop.indicator ? `${stop.name} (${stop.indicator})` : stop.name
      const icon = labels ? placeStopPlate(map, title, stop.routes, "#DC241F") : ""
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [stop.lng, stop.lat] },
        properties: {
          id: stop.id,
          name: stop.name,
          indicator: stop.indicator,
          routes: JSON.stringify(stop.routes),
          ...(icon ? { icon } : {}),
        },
      }
    }),
  }
}

function cycleCollection(docks: CycleDock[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: docks.map((dock) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [dock.lng, dock.lat] },
      properties: { id: dock.id, name: dock.name, bikes: dock.bikes, ebikes: dock.ebikes, empty: dock.empty, available: dock.bikes + dock.ebikes },
    })),
  }
}

function planningCollection(apps: PlanningApp[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: apps.map((app) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [app.lng, app.lat] },
      properties: { ...app },
    })),
  }
}

function airCollection(sites: AirSite[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: sites.map((site) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [site.lng, site.lat] },
      properties: {
        code: site.code,
        name: site.name,
        band: site.band,
        species: site.species,
        ...(site.index == null ? {} : { index: site.index }),
      },
    })),
  }
}

function platedStations(map: Map, collection: GeoJSON.FeatureCollection, mode: RailMode, labels: boolean): GeoJSON.FeatureCollection {
  if (!labels) return collection
  const stroke = mode === "rail" ? "#7dd3e8" : mode === "light" ? "#00A4A7" : "#38BDF8"
  return {
    type: "FeatureCollection",
    features: collection.features.map((feature) => {
      const properties = feature.properties ?? {}
      const code = typeof properties.code === "string" ? properties.code : ""
      const name = typeof properties.name === "string" ? properties.name : ""
      const lines = linesThrough(code, mode).map((line) => lineRecord(line)?.name ?? line)
      const icon = placeStopPlate(map, name, mode === "river" ? [] : lines, stroke)
      return { ...feature, properties: { ...properties, ...(icon ? { icon } : {}) } }
    }),
  }
}
