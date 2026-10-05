"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import { useSearchParams } from "next/navigation"
import { CityMap } from "@/components/city-map"
import { LayerDock } from "@/components/layer-dock"
import { OpsHud } from "@/components/ops-hud"
import { useLiveJson } from "@/components/use-live-json"
import { useI18n } from "@/components/locale"
import { boardFaultSnapshot, subscribeBoardFaults } from "@/lib/board-status"
import { thamesCrossings } from "@/lib/crossings"
import type { FeedFaults } from "@/lib/intel"
import { BUS_MIN_ZOOM, PLACE_POLL_MS, busViewQuery, placePinZoom, type MapView } from "@/lib/map-view"
import { catalogueBoards } from "@/lib/place-arrivals"
import { preferenceServerSnapshot, preferenceSnapshot, soleLayer, subscribePreferences, updatePreference } from "@/lib/preferences"
import type {
  AirResponse,
  Basemap,
  BusPlacesResponse,
  BusVehiclesResponse,
  CamerasResponse,
  CyclesResponse,
  DisruptionsResponse,
  PlanningResponse,
  RailResponse,
  RoadsResponse,
  StatusResponse,
  WarningsResponse,
  WatchLayers,
} from "@/lib/types"

function liveError(error: string | null, body: { ok: boolean; error?: string } | null, fallback: string): string | null {
  if (error) return error
  if (!body) return null
  return body.error ?? (body.ok ? null : fallback)
}

export function Dashboard() {
  const { messages: m } = useI18n()
  const search = useSearchParams()
  const mapDown = search.get("map") === "down"
  const prefs = useSyncExternalStore(subscribePreferences, preferenceSnapshot, preferenceServerSnapshot)
  const [flyToken, setFlyToken] = useState(0)
  const [mapLive, setMapLive] = useState(!mapDown)
  const [view, setView] = useState<MapView | null>(null)
  const [focus, setFocus] = useState<{ id: string; coordinates: [number, number] } | null>(null)
  const layers = prefs.layers
  const basemap = prefs.basemap
  const sole = soleLayer(layers)

  const roadsLive = useLiveJson<RoadsResponse>("/api/roads")
  const disruptionsLive = useLiveJson<DisruptionsResponse>("/api/disruptions", 120_000)
  const statusLive = useLiveJson<StatusResponse>("/api/status")
  const weatherLive = useLiveJson<WarningsResponse>("/api/weather", 5 * 60_000)
  const camerasLive = useLiveJson<CamerasResponse>(layers.cameras ? "/api/cameras" : null, 5 * 60_000)
  const railLive = useLiveJson<RailResponse>(layers.rail ? "/api/rail" : null, 15_000)
  const lightLive = useLiveJson<RailResponse>(layers.light ? "/api/light" : null, 15_000)
  const riverLive = useLiveJson<RailResponse>(layers.river ? "/api/river" : null, 30_000)
  const cyclesLive = useLiveJson<CyclesResponse>(layers.cycles ? "/api/cycles" : null, 2 * 60_000)
  const airLive = useLiveJson<AirResponse>(layers.air ? "/api/air" : null, 15 * 60_000)
  const viewQuery = (layer: "bus" | "planning") =>
    view && view.zoom >= placePinZoom(layer, sole)
      ? `lng=${view.lng.toFixed(3)}&lat=${view.lat.toFixed(3)}&zoom=${view.zoom.toFixed(2)}`
      : null
  const busQuery = viewQuery("bus")
  const planningQuery = viewQuery("planning")
  const busLive = useLiveJson<BusPlacesResponse>(layers.bus && busQuery ? `/api/bus/places?${busQuery}` : null, PLACE_POLL_MS)
  const busesUrl = layers.bus && view && view.zoom >= BUS_MIN_ZOOM ? `/api/buses?${busViewQuery(view)}` : null
  const busesLive = useLiveJson<BusVehiclesResponse>(busesUrl, 20_000)
  const planningLive = useLiveJson<PlanningResponse>(layers.planning && planningQuery ? `/api/planning?${planningQuery}` : null, PLACE_POLL_MS)
  const boardFaults = useSyncExternalStore(subscribeBoardFaults, boardFaultSnapshot, boardFaultSnapshot)

  const roads = roadsLive.data
  const disruptions = disruptionsLive.data?.ok ? disruptionsLive.data : null
  const status = statusLive.data?.ok ? statusLive.data : null
  const weather = weatherLive.data
  const corridors = useMemo(() => (roads?.ok ? roads.corridors : []), [roads])
  const lines = useMemo(() => status?.lines ?? [], [status])
  const lifts = useMemo(() => status?.lifts ?? [], [status])
  const transit = useMemo(() => ({ lines, lifts }), [lines, lifts])
  const rail = useMemo(
    () => ({
      rail: railLive.data?.ok ? railLive.data : null,
      light: lightLive.data?.ok ? lightLive.data : null,
      river: riverLive.data?.ok ? riverLive.data : null,
    }),
    [lightLive.data, railLive.data, riverLive.data],
  )
  const bus = useMemo(() => catalogueBoards(busLive.data), [busLive.data])
  const crossings = useMemo(
    () => thamesCrossings(corridors, [...(disruptions?.incidents.features ?? []), ...(disruptions?.works.features ?? [])], lines),
    [corridors, disruptions, lines],
  )
  const roadsLoading = roads === null && roadsLive.error === null
  const faults: FeedFaults = {
    roads: liveError(roadsLive.error, roads, "Road status failed"),
    disruptions: liveError(disruptionsLive.error, disruptionsLive.data, "Road disruptions failed"),
    status: liveError(statusLive.error, statusLive.data, "Line status failed"),
    weather: liveError(weatherLive.error, weather, "Weather failed"),
    cameras: liveError(camerasLive.error, camerasLive.data, "Cameras failed"),
    rail: liveError(railLive.error, railLive.data, "Arrivals failed"),
    light: liveError(lightLive.error, lightLive.data, "Arrivals failed"),
    river: liveError(riverLive.error, riverLive.data, "Arrivals failed"),
    buses: liveError(busesLive.error, busesLive.data, "Bus positions failed"),
    cycles: liveError(cyclesLive.error, cyclesLive.data, "Cycle docks failed"),
    air: liveError(airLive.error, airLive.data, "Air quality failed"),
    planning: liveError(planningLive.error, planningLive.data, "Planning failed"),
    map: mapLive ? null : m.mapFailed,
  }

  function setLayers(next: WatchLayers) {
    updatePreference({ layers: next })
  }

  function selectBasemap(next: Basemap) {
    if (next === "buildings") {
      updatePreference((current) => ({ basemap: current.basemap === "buildings" ? current.ground : "buildings" }))
      return
    }
    updatePreference({ basemap: next, ground: next })
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-[#061018]">
      <CityMap
        corridors={corridors}
        cameras={camerasLive.data?.ok ? camerasLive.data.cameras : null}
        works={disruptions?.works ?? null}
        incidents={disruptions?.incidents ?? null}
        rail={rail}
        transit={transit}
        bus={bus}
        buses={busesLive.data?.ok ? busesLive.data.vehicles : null}
        cycles={cyclesLive.data?.ok ? cyclesLive.data.docks : null}
        planning={planningLive.data?.ok ? planningLive.data.apps : null}
        air={airLive.data?.ok ? airLive.data.sites : null}
        onView={setView}
        layers={layers}
        basemap={basemap}
        flyToken={flyToken}
        focus={focus}
        disabled={mapDown}
        onMap={setMapLive}
      />
      <OpsHud
        roads={roads}
        roadsLoading={roadsLoading}
        corridors={corridors}
        incidents={disruptions?.incidents ?? null}
        works={disruptions?.works ?? null}
        crossings={crossings}
        lines={lines}
        lifts={lifts}
        warnings={weather?.warnings ?? []}
        warningsReady={weather != null || weatherLive.error != null}
        conditions={weather?.conditions ?? null}
        air={airLive.data?.ok ? airLive.data.sites : []}
        faults={faults}
        mapLive={mapLive}
        boardFaults={boardFaults}
        open={prefs.intelOpen}
        onOpenChange={(open) => updatePreference({ intelOpen: open })}
        onFocus={setFocus}
      />
      <p
        data-map-chrome="bottom"
        className="pointer-events-auto absolute bottom-1 left-2 z-30 max-w-[calc(100%-1rem)] bg-[#041018]/92 px-2 py-1 font-[family-name:var(--font-hud)] text-[0.72rem] leading-snug text-white sm:bottom-[0.4rem] sm:left-3 sm:max-w-[min(26rem,calc(100%-26rem))] sm:whitespace-nowrap"
      >
        {m.creditBy}{" "}
        <a
          href="https://www.linkedin.com/in/keithlihk"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-100 underline decoration-cyan-200/60 underline-offset-2"
        >
          {m.creditLinkedIn}
        </a>
        {" / "}
        <a
          href="https://github.com/keithligh/hk-traffic-intelligence"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-100 underline decoration-cyan-200/60 underline-offset-2"
        >
          {m.creditGitHub}
        </a>
      </p>
      <LayerDock
        layers={layers}
        basemap={basemap}
        counts={{
          works: disruptions ? disruptions.works.features.length : null,
          incidents: disruptions ? disruptions.incidents.features.length : null,
        }}
        onSetLayers={setLayers}
        onBasemap={selectBasemap}
        onReplay={() => setFlyToken((value) => value + 1)}
        mapLive={mapLive}
        aboveMarquee={!prefs.intelOpen}
      />
    </main>
  )
}
