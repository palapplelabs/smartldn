"use client"

import { useState, useSyncExternalStore } from "react"
import { useSearchParams } from "next/navigation"
import { CityMap } from "@/components/city-map"
import { LayerDock } from "@/components/layer-dock"
import { OpsHud } from "@/components/ops-hud"
import { useLiveJson } from "@/components/use-live-json"
import { useI18n } from "@/components/locale"
import { decorateControlPoints } from "@/lib/control-points"
import { PLACE_POLL_MS, placePinZoom } from "@/lib/kmb-view"
import type { ParkingPlacesResponse } from "@/lib/parking"
import { inLantau } from "@/lib/lantau"
import { PICTURE_POLL_MS } from "@/lib/picture"
import { boardFaultSnapshot, subscribeBoardFaults } from "@/lib/board-status"
import { catalogueBoards } from "@/lib/place-arrivals"
import { preferenceServerSnapshot, preferenceSnapshot, soleLayer, subscribePreferences, updatePreference } from "@/lib/preferences"
import { hkoLang } from "@/lib/i18n"
import type {
  ApproachesResponse,
  CitybusPlacesResponse,
  ControlPointsResponse,
  FerryResponse,
  GmbPlacesResponse,
  IncidentsResponse,
  KmbPlacesResponse,
  LrtResponse,
  MtrResponse,
  NlbPlacesResponse,
  PictureResponse,
  TrafficResponse,
  WarningsResponse,
  WatchLayers,
  Basemap,
} from "@/lib/types"

function liveError(error: string | null, body: { ok: boolean; error?: string } | null, fallback: string): string | null {
  if (error) return error
  if (!body) return null
  return body.error ?? (body.ok ? null : fallback)
}

export function Dashboard() {
  const { locale, messages: m } = useI18n()
  const search = useSearchParams()
  const forceDown = search.get("feed") === "down"
  const mapDown = search.get("map") === "down"
  const prefs = useSyncExternalStore(subscribePreferences, preferenceSnapshot, preferenceServerSnapshot)
  const [flyToken, setFlyToken] = useState(0)
  const [mapLive, setMapLive] = useState(!mapDown)
  const layers = prefs.layers
  const basemap = prefs.basemap
  const trafficLive = useLiveJson<TrafficResponse>(forceDown ? "/api/traffic?simulate=fail" : "/api/traffic")
  const approachesLive = useLiveJson<ApproachesResponse>("/api/approaches")
  const pictureLive = useLiveJson<PictureResponse>("/api/picture", PICTURE_POLL_MS)
  const incidentsLive = useLiveJson<IncidentsResponse>("/api/incidents")
  const controlLive = useLiveJson<ControlPointsResponse>("/api/control-points")
  const warningsLive = useLiveJson<WarningsResponse>(`/api/warnings?lang=${hkoLang(locale)}`)
  const [view, setView] = useState<{ lng: number; lat: number; zoom: number } | null>(null)
  const sole = soleLayer(layers)
  const kmbQuery =
    view && view.zoom >= placePinZoom("kmb", sole)
      ? `lng=${view.lng.toFixed(3)}&lat=${view.lat.toFixed(3)}&zoom=${view.zoom.toFixed(2)}`
      : null
  const citybusQuery =
    view && view.zoom >= placePinZoom("citybus", sole)
      ? `lng=${view.lng.toFixed(3)}&lat=${view.lat.toFixed(3)}`
      : null
  const kmbPlacesUrl = layers.kmb && kmbQuery ? `/api/kmb/places?${kmbQuery}` : null
  const citybusPlacesUrl = layers.citybus && citybusQuery ? `/api/citybus/places?${citybusQuery}` : null
  const gmbQuery =
    view && view.zoom >= placePinZoom("gmb", sole)
      ? `lng=${view.lng.toFixed(3)}&lat=${view.lat.toFixed(3)}&zoom=${view.zoom.toFixed(2)}`
      : null
  const gmbPlacesUrl = layers.gmb && gmbQuery ? `/api/gmb/places?${gmbQuery}` : null
  const nlbQuery =
    view && view.zoom >= placePinZoom("nlb", sole) && (sole === "nlb" || inLantau(view.lng, view.lat))
      ? `lng=${view.lng.toFixed(3)}&lat=${view.lat.toFixed(3)}`
      : null
  const nlbPlacesUrl = layers.nlb && nlbQuery ? `/api/nlb/places?${nlbQuery}` : null
  const parkingWide = sole === "parking"
  const parkingPlacesUrl =
    layers.parking && view && view.zoom >= placePinZoom("parking", sole)
      ? `/api/parking/places?lng=${view.lng.toFixed(3)}&lat=${view.lat.toFixed(3)}&zoom=${view.zoom.toFixed(2)}${parkingWide ? "&wide=1" : ""}`
      : null
  const mtrLive = useLiveJson<MtrResponse>("/api/mtr", 15_000)
  const kmbPlacesLive = useLiveJson<KmbPlacesResponse>(kmbPlacesUrl, PLACE_POLL_MS)
  const lrtLive = useLiveJson<LrtResponse>(layers.lrt ? "/api/lrt" : null, 15_000)
  const citybusPlacesLive = useLiveJson<CitybusPlacesResponse>(citybusPlacesUrl, PLACE_POLL_MS)
  const gmbPlacesLive = useLiveJson<GmbPlacesResponse>(gmbPlacesUrl, PLACE_POLL_MS)
  const nlbPlacesLive = useLiveJson<NlbPlacesResponse>(nlbPlacesUrl, PLACE_POLL_MS)
  const ferryLive = useLiveJson<FerryResponse>(layers.ferry ? "/api/ferry" : null, 60_000)
  const parkingPlacesLive = useLiveJson<ParkingPlacesResponse>(parkingPlacesUrl, PLACE_POLL_MS)
  const traffic = trafficLive.data
  const approaches = approachesLive.data
  const picture = pictureLive.data
  const incidents = incidentsLive.data
  const controlPoints = controlLive.data
  const warnings = warningsLive.data
  const mtr = mtrLive.data
  const kmb = catalogueBoards(kmbPlacesLive.data)
  const lrt = lrtLive.data
  const citybus = catalogueBoards(citybusPlacesLive.data)
  const gmb = catalogueBoards(gmbPlacesLive.data)
  const nlb = catalogueBoards(nlbPlacesLive.data)
  const ferry = ferryLive.data
  const trafficLoading = traffic === null && trafficLive.error === null
  const trafficError = trafficLive.error ?? (traffic && !traffic.ok ? traffic.error ?? "Speed feed failed" : null)
  const pictureError = pictureLive.error ?? picture?.error ?? (picture && !picture.ok ? "Picture failed" : null)
  const [focus, setFocus] = useState<{ id: string; coordinates: [number, number] } | null>(null)
  const intelOpen = prefs.intelOpen
  const boardFaults = useSyncExternalStore(subscribeBoardFaults, boardFaultSnapshot, boardFaultSnapshot)

  const corridors = traffic?.ok ? traffic.corridors : []
  const boundary = controlPoints?.ok ? decorateControlPoints(controlPoints.points, corridors) : null

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
        approaches={approaches?.ok ? approaches.points : []}
        picture={picture}
        incidents={incidents?.ok ? incidents.incidents : null}
        controlPoints={boundary}
        mtr={mtr?.ok ? mtr : null}
        kmb={kmb}
        lrt={lrt?.ok ? lrt : null}
        citybus={citybus}
        gmb={gmb}
        nlb={nlb}
        ferry={ferry?.ok ? ferry : null}
        parking={parkingPlacesLive.data?.ok ? parkingPlacesLive.data.parks : null}
        onView={setView}
        layers={layers}
        basemap={basemap}
        flyToken={flyToken}
        focus={focus}
        disabled={mapDown}
        onMap={setMapLive}
      />
      <OpsHud
        traffic={traffic}
        trafficLoading={trafficLoading}
        trafficError={trafficError}
        approaches={approaches}
        incidents={incidents?.ok ? incidents.incidents : null}
        incidentsError={incidentsLive.error ?? (incidents && !incidents.ok ? incidents.error ?? "Special traffic news failed." : null)}
        works={picture?.works ?? null}
        controlPoints={boundary}
        controlError={controlLive.error ?? (controlPoints && !controlPoints.ok ? controlPoints.error ?? "Control point waiting times failed." : null)}
        warnings={warnings?.warnings ?? []}
        warningsReady={warnings != null || warningsLive.error != null}
        warningsError={warningsLive.error ?? warnings?.error ?? null}
        conditions={warnings?.conditions ?? null}
        approachesError={approachesLive.error ?? (approaches && !approaches.ok ? approaches.error ?? "Crossing approaches failed." : null)}
        mapLive={mapLive}
        pictureError={pictureError}
        mtrError={mtrLive.error ?? (mtr && !mtr.ok ? mtr.error ?? "Next train feed failed" : null)}
        kmbError={liveError(kmbPlacesLive.error, kmbPlacesLive.data, "KMB stops failed")}
        lrtError={lrtLive.error ?? (lrt && !lrt.ok ? lrt.error ?? "Light Rail arrivals failed" : null)}
        citybusError={liveError(citybusPlacesLive.error, citybusPlacesLive.data, "Citybus stops failed")}
        gmbError={liveError(gmbPlacesLive.error, gmbPlacesLive.data, "Green minibus stops failed")}
        nlbError={liveError(nlbPlacesLive.error, nlbPlacesLive.data, "New Lantao Bus stops failed")}
        ferryError={liveError(ferryLive.error, ferryLive.data, "Ferry arrivals failed")}
        boardFaults={boardFaults}
        open={intelOpen}
        onOpenChange={(open) => updatePreference({ intelOpen: open })}
        onFocus={setFocus}
        view={view}
      />
      <p
        data-map-chrome="bottom"
        className="pointer-events-auto absolute bottom-1 left-2 z-30 max-w-[calc(100%-1rem)] bg-[#041018]/92 px-2 py-1 font-[family-name:var(--font-hud)] text-[0.72rem] leading-snug text-white sm:bottom-[0.4rem] sm:left-3 sm:max-w-[min(22rem,calc(100%-26rem))] sm:whitespace-nowrap"
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
          href="https://github.com/keithligh"
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
          speed: null,
          cameras: null,
          works: picture ? picture.works.features.length : null,
          tolls: null,
          incidents: incidents ? incidents.incidents.features.length : null,
          mtr: null,
          kmb: null,
          lrt: null,
          citybus: null,
          gmb: null,
          nlb: null,
          ferry: null,
          parking: null,
          control: null,
        }}
        onSetLayers={setLayers}
        onBasemap={selectBasemap}
        onReplay={() => setFlyToken((value) => value + 1)}
        mapLive={mapLive}
        pictureError={pictureError}
        mtrError={mtrLive.error ?? (mtr && !mtr.ok ? mtr.error ?? "Next train feed failed" : null)}
        kmbError={liveError(kmbPlacesLive.error, kmbPlacesLive.data, "KMB stops failed")}
        lrtError={lrtLive.error ?? (lrt && !lrt.ok ? lrt.error ?? "Light Rail arrivals failed" : null)}
        citybusError={liveError(citybusPlacesLive.error, citybusPlacesLive.data, "Citybus stops failed")}
        gmbError={liveError(gmbPlacesLive.error, gmbPlacesLive.data, "Green minibus stops failed")}
        nlbError={liveError(nlbPlacesLive.error, nlbPlacesLive.data, "New Lantao Bus stops failed")}
        ferryError={liveError(ferryLive.error, ferryLive.data, "Ferry arrivals failed")}
        parkingError={liveError(parkingPlacesLive.error, parkingPlacesLive.data, "Parking catalogue failed")}
        aboveMarquee={!intelOpen}
      />
    </main>
  )
}
