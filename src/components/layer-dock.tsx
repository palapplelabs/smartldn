"use client"

import { useRef, useState } from "react"
import { useI18n } from "@/components/locale"
import type { Messages } from "@/lib/i18n"
import { chooseWatchedLayer } from "@/lib/preferences"
import type { Basemap, WatchLayer, WatchLayers } from "@/lib/types"

type LayerDockProps = {
  layers: WatchLayers
  basemap: Basemap
  counts: Partial<Record<WatchLayer, number | null>>
  onSetLayers: (layers: WatchLayers) => void
  onBasemap: (basemap: Basemap) => void
  onReplay: () => void
  mapLive: boolean
  aboveMarquee: boolean
}

const ROAD_KEY = [
  { color: "#3DDC97", key: "good" },
  { color: "#FFC857", key: "average" },
  { color: "#FF5D73", key: "bad" },
] as const

function layerLabel(id: WatchLayer, m: Messages): string {
  switch (id) {
    case "roads":
      return m.roadsLayer
    case "cameras":
      return m.cameras
    case "works":
      return m.worksLayer
    case "incidents":
      return m.incidentsLayer
    case "charges":
      return m.charges
    case "rail":
      return m.rail
    case "light":
      return m.light
    case "bus":
      return m.bus
    case "river":
      return m.river
    case "cycles":
      return m.cycles
    case "planning":
      return m.planning
    case "air":
      return m.air
    default: {
      const exhaustive: never = id
      return exhaustive
    }
  }
}

function basemapLabel(id: Basemap, m: Messages): string {
  switch (id) {
    case "satellite":
      return m.satellite
    case "street":
      return m.streets
    case "buildings":
      return m.buildings
    default: {
      const exhaustive: never = id
      return exhaustive
    }
  }
}

const BASEMAPS: Basemap[] = ["satellite", "street", "buildings"]
const COUNTED_LAYERS: ReadonlySet<WatchLayer> = new Set(["works", "incidents"])
const LAYERS: { id: WatchLayer; swatch: string }[] = [
  { id: "roads", swatch: "bg-[#3DDC97]" },
  { id: "cameras", swatch: "bg-[#7DD3E8]" },
  { id: "works", swatch: "bg-[#FFC857]" },
  { id: "incidents", swatch: "bg-[#FF5D73]" },
  { id: "charges", swatch: "bg-[#D7B4FF]" },
  { id: "rail", swatch: "bg-[#E32017]" },
  { id: "light", swatch: "bg-[#00A4A7]" },
  { id: "bus", swatch: "bg-[#DC241F]" },
  { id: "river", swatch: "bg-[#38BDF8]" },
  { id: "cycles", swatch: "bg-[#5EEAD4]" },
  { id: "planning", swatch: "bg-[#F97316]" },
  { id: "air", swatch: "bg-[#C026D3]" },
]

export function LayerDock(props: LayerDockProps) {
  const { messages: m } = useI18n()
  const [only, setOnly] = useState(false)
  const mix = useRef<WatchLayers | null>(null)
  if (!props.mapLive) return null

  function choose(id: WatchLayer) {
    const next = chooseWatchedLayer(only, props.layers, id)
    if (next.only !== only) {
      if (!next.only) mix.current = null
      setOnly(next.only)
    }
    props.onSetLayers(next.layers)
  }

  function switchOnly() {
    if (only) {
      if (mix.current) props.onSetLayers(mix.current)
      mix.current = null
      setOnly(false)
      return
    }
    mix.current = props.layers
    setOnly(true)
  }
  return (
    <div
      data-map-chrome="bottom"
      data-layer-dock=""
      className={`pointer-events-auto absolute left-4 z-10 flex max-w-[calc(100%-2rem)] flex-col gap-2 lg:left-16 ${
        props.aboveMarquee
          ? "bottom-[var(--dock-closed-bottom,9rem)] sm:bottom-28"
          : "bottom-[var(--map-dock-bottom,7rem)] sm:bottom-14 sm:max-w-[calc(100%-24rem)] lg:max-w-[calc(100%-30rem)]"
      }`}
    >
      <div className="flex max-w-full items-center gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible">
      <div className="inline-flex shrink-0 border border-white/15" role="group" aria-label={m.basemap}>
        {BASEMAPS.map((id) => {
          const on = props.basemap === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => props.onBasemap(id)}
              className={`px-2.5 py-1.5 font-[family-name:var(--font-hud)] text-[0.72rem] tracking-[0.08em] uppercase ${
                on ? "bg-[#041018]/80 text-white" : "bg-[#041018]/55 text-zinc-400"
              }`}
            >
              {basemapLabel(id, m)}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        aria-pressed={only}
        onClick={switchOnly}
        className={`shrink-0 border px-2.5 py-1.5 font-[family-name:var(--font-hud)] text-[0.72rem] tracking-[0.08em] uppercase ${
          only ? "border-cyan-200/50 bg-[#041018]/80 text-white" : "border-white/15 bg-[#041018]/70 text-cyan-50"
        }`}
      >
        {m.layerOnly}
      </button>
      {LAYERS.map((layer) => {
        const on = props.layers[layer.id]
        const count = COUNTED_LAYERS.has(layer.id) ? props.counts[layer.id] ?? null : null
        return (
          <button
            key={layer.id}
            type="button"
            aria-pressed={on}
            onClick={() => choose(layer.id)}
            className={`inline-flex shrink-0 items-center gap-2 border px-2.5 py-1.5 font-[family-name:var(--font-hud)] text-[0.72rem] tracking-[0.08em] uppercase ${
              on
                ? "border-cyan-200/50 bg-[#041018]/80 text-white"
                : "border-white/15 bg-[#041018]/55 text-zinc-400"
            }`}
          >
            <span className={`size-2 rounded-full ${layer.swatch} ${on ? "" : "opacity-35"}`} />
            {layerLabel(layer.id, m)}
            {count == null ? "" : ` ${count}`}
          </button>
        )
      })}
      <button
        type="button"
        onClick={props.onReplay}
        className="shrink-0 border border-white/15 bg-[#041018]/70 px-2.5 py-1.5 font-[family-name:var(--font-hud)] text-[0.72rem] tracking-[0.08em] text-cyan-50 uppercase"
      >
        {m.replay}
      </button>
      </div>
      {props.layers.roads ? (
        <p
          className="basis-full flex flex-wrap items-center gap-x-3 gap-y-1 font-[family-name:var(--font-hud)] text-[0.68rem] tracking-[0.06em] text-cyan-50/90 uppercase"
          aria-label={m.roadsKey}
          title={m.roadsKey}
        >
          {ROAD_KEY.map((band) => (
            <span key={band.key} className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full" style={{ background: band.color }} />
              {m[band.key]}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  )
}
