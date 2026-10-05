"use client"

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react"
import { createPortal, flushSync } from "react-dom"
import { useI18n } from "@/components/locale"
import { boundaryGlance } from "@/lib/control-points"
import { crossingsFrom, nearestApproach } from "@/lib/crossings"
import { displayText, formatClock, LOCALE_MARK, LOCALES, type Messages } from "@/lib/i18n"
import { CHANGELOG, changelogText } from "@/lib/changelog"
import type { BoardFault } from "@/lib/board-status"
import { firstOpenBoundary, INTEL_TABS, intelBoard, type IntelItem, type IntelTab } from "@/lib/intel"
import { preferenceServerSnapshot, preferenceSnapshot, subscribePreferences, updatePreference } from "@/lib/preferences"
import { formatSpeed } from "@/lib/speed"
import type { ApproachPoint, ApproachesResponse, HarbourJourney, TrafficResponse, WeatherConditions, WeatherWarning } from "@/lib/types"
import { weatherBar } from "@/lib/warnings"

type OpsHudProps = {
  traffic: TrafficResponse | null
  trafficLoading: boolean
  trafficError: string | null
  approaches: ApproachesResponse | null
  approachesError: string | null
  incidents: GeoJSON.FeatureCollection | null
  incidentsError: string | null
  works: GeoJSON.FeatureCollection | null
  controlPoints: GeoJSON.FeatureCollection | null
  controlError: string | null
  warnings: WeatherWarning[]
  warningsReady: boolean
  warningsError: string | null
  conditions: WeatherConditions | null
  mapLive: boolean
  pictureError: string | null
  mtrError: string | null
  kmbError: string | null
  lrtError: string | null
  citybusError: string | null
  gmbError: string | null
  nlbError: string | null
  ferryError: string | null
  boardFaults: readonly BoardFault[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onFocus: (focus: { id: string; coordinates: [number, number] }) => void
  view: { lng: number; lat: number; zoom: number } | null
}

const TONE: Record<HarbourJourney["colour"], string> = {
  red: "#FF5D73",
  amber: "#FFC857",
  green: "#3DDC97",
  none: "#C9D2DC",
}

const BAR_KEY = {
  CH: "cross",
  EH: "eastern",
  WH: "western",
} as const

export function OpsHud(props: OpsHudProps) {
  const { locale, setLocale, messages: m } = useI18n()
  const clock = useHongKongClock(locale)
  const prefs = useSyncExternalStore(subscribePreferences, preferenceSnapshot, preferenceServerSnapshot)
  const tab = prefs.intelTab
  const setTab = (next: IntelTab) => updatePreference({ intelTab: next })
  const barOpen = prefs.barOpen
  const setBarOpen = (next: boolean) => updatePreference({ barOpen: next })
  const pinnedOrigin = prefs.pinnedOrigin
  const setPinnedOrigin = (next: string | null) => updatePreference({ pinnedOrigin: next })
  const open = props.open
  const approachPoints = props.approaches?.ok ? props.approaches.points : []
  const nearest = nearestApproach(approachPoints, props.view)
  const pinned = pinnedOrigin ? approachPoints.find((point) => point.id === pinnedOrigin) ?? null : null
  const origin = pinned ?? nearest
  const crossings = crossingsFrom(origin)
  const islandPoints = approachPoints.filter((point) => point.id.startsWith("H"))
  const kowloonPoints = approachPoints.filter((point) => point.id.startsWith("K"))
  const summary = props.traffic?.ok ? props.traffic.summary : null
  const totalBands = summary ? summary.free + summary.slow + summary.congested : 0
  const live = Boolean(summary) && !props.trafficError
  const board = intelBoard({
    trafficError: props.trafficError,
    traffic: props.traffic,
    incidents: props.incidents,
    incidentsError: props.incidentsError,
    works: props.works,
    controlPoints: props.controlPoints,
    controlError: props.controlError,
    approaches: props.approaches?.ok ? props.approaches.points : [],
    approachesError: props.approachesError,
    warnings: props.warnings,
    warningsReady: props.warningsReady,
    warningsError: props.warningsError,
    conditions: props.conditions,
    pictureError: props.pictureError,
    mtrError: props.mtrError,
    kmbError: props.kmbError,
    lrtError: props.lrtError,
    citybusError: props.citybusError,
    gmbError: props.gmbError,
    nlbError: props.nlbError,
    ferryError: props.ferryError,
    mapError: props.mapLive ? null : m.mapFailed,
    boardFaults: props.boardFaults,
  }, m)
  const intel = board[tab]
  const ranked = board.ranked
  const urgentCount = ranked.filter((item) => item.urgent).length
  const marqueeSeconds = Math.max(28, ranked.length * 9)
  const halls = boundaryGlance(props.controlPoints, props.controlError, m)
  const weather = weatherBar(props.warnings, props.conditions)
  const incidentCount = props.incidents?.features.length ?? 0
  const firstIncident = board.roads.find((item) => item.kind === "incident" && item.coordinates)
  const worstRoad = board.roads.find((item) => item.coordinates && (item.kind === "jam" || item.kind === "slow" || item.kind === "incident"))
  const worstHall = firstOpenBoundary(board.boundary)
  const changeOpen = (next: boolean) => {
    if (next === open) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced || typeof document.startViewTransition !== "function") {
      props.onOpenChange(next)
      return
    }
    try {
      document.startViewTransition(() => {
        flushSync(() => props.onOpenChange(next))
      })
    } catch {
      props.onOpenChange(next)
    }
  }
  const show = (next: IntelTab, item: IntelItem | undefined) => {
    setTab(next)
    changeOpen(true)
    if (item?.coordinates) props.onFocus({ id: item.id, coordinates: item.coordinates })
  }
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const narrow = window.matchMedia("(max-width: 639px)").matches
      const attrib = document.querySelector<HTMLElement>(".maplibregl-ctrl-attrib")
      const attribBox = attrib?.getBoundingClientRect()
      if (narrow && !open && attribBox && attribBox.height > 2) {
        const clearance = Math.ceil(window.innerHeight - attribBox.top + 8)
        root.style.setProperty("--marquee-bottom", `${clearance}px`)
        root.style.setProperty("--dock-closed-bottom", `${clearance + 48}px`)
      } else {
        root.style.removeProperty("--marquee-bottom")
        root.style.removeProperty("--dock-closed-bottom")
      }
      const scroll = document.querySelector<HTMLElement>(".bar-scroll")
      if (scroll) scroll.classList.toggle("bar-scroll-more", scroll.scrollWidth > scroll.clientWidth + 2)
      const header = document.querySelector<HTMLElement>("[data-map-chrome='top']")
      const panel = document.querySelector<HTMLElement>("[data-map-chrome='panel']")
      const list = document.getElementById("harbour-intel-list")
      const headerBox = header?.getBoundingClientRect()
      const headerVisible = !!headerBox && headerBox.height > 2 && headerBox.left <= 56
      if (open && list && panel && headerVisible && headerBox) {
        const dock = document.querySelector<HTMLElement>("[data-layer-dock]")
        const zoom = document.querySelector<HTMLElement>(".maplibregl-ctrl-top-left")
        const dockBox = dock?.getBoundingClientRect()
        const zoomBox = zoom?.getBoundingClientRect()
        const dockH = dockBox && dockBox.height > 2 ? dockBox.height : 0
        const zoomH = zoomBox && zoomBox.height > 2 ? zoomBox.height : 0
        const aboveList = Math.max(0, list.getBoundingClientRect().top - panel.getBoundingClientRect().top)
        let bottomGap = narrow ? 96 : window.innerWidth >= 1024 ? 56 : 144
        if (narrow && attribBox && attribBox.height > 2) {
          bottomGap = Math.max(bottomGap, Math.ceil(window.innerHeight - attribBox.top + 14))
        }
        if (narrow) root.style.setProperty("--intel-bottom", `${bottomGap}px`)
        else root.style.removeProperty("--intel-bottom")
        const minTop = Math.ceil(headerBox.bottom + (narrow ? zoomH + dockH + 28 : 8))
        const available = window.innerHeight - bottomGap - minTop - aboveList
        root.style.setProperty("--intel-list-max", `${Math.max(72, Math.floor(available))}px`)
      } else {
        root.style.removeProperty("--intel-list-max")
        root.style.removeProperty("--intel-bottom")
      }
      const panelBox = panel?.getBoundingClientRect()
      if (narrow && open && panelBox && panelBox.height > 80 && panelBox.top > 80) {
        root.style.setProperty("--map-dock-bottom", `${Math.ceil(window.innerHeight - panelBox.top + 8)}px`)
      } else {
        root.style.removeProperty("--map-dock-bottom")
      }
      if (!headerVisible || !headerBox || window.matchMedia("(min-width: 1024px)").matches) {
        root.style.removeProperty("--map-control-top")
        return
      }
      root.style.setProperty("--map-control-top", `${Math.ceil(headerBox.bottom + 6)}px`)
    }
    apply()
    const header = document.querySelector("[data-map-chrome='top']")
    const panel = document.querySelector("[data-map-chrome='panel']")
    const dock = document.querySelector("[data-layer-dock]")
    const observer = new ResizeObserver(apply)
    const watchCorner = () => {
      const corner = document.querySelector(".maplibregl-ctrl-bottom-right")
      if (corner) observer.observe(corner)
    }
    if (header) observer.observe(header)
    if (panel) observer.observe(panel)
    if (dock) observer.observe(dock)
    watchCorner()
    const map = document.querySelector(".maplibregl-map")
    const mutations = new MutationObserver(() => {
      watchCorner()
      apply()
    })
    if (map) mutations.observe(map, { childList: true, subtree: true })
    window.addEventListener("resize", apply)
    return () => {
      observer.disconnect()
      mutations.disconnect()
      window.removeEventListener("resize", apply)
      root.style.removeProperty("--map-control-top")
      root.style.removeProperty("--map-dock-bottom")
      root.style.removeProperty("--intel-list-max")
      root.style.removeProperty("--intel-bottom")
      root.style.removeProperty("--marquee-bottom")
      root.style.removeProperty("--dock-closed-bottom")
    }
  }, [barOpen, locale, open, props.mapLive])
  return (
    <div className="@container/hud pointer-events-none absolute inset-0 z-[5]">
      {barOpen ? null : (
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setBarOpen(true)}
          className="pointer-events-auto absolute top-2 left-2 border border-cyan-200/30 bg-[#041018]/88 px-2 py-1 font-[family-name:var(--font-hud)] text-sm text-white sm:hidden"
        >
          {m.productName}
        </button>
      )}
      <header
        data-map-chrome="top"
        className={`pointer-events-auto absolute top-2 right-2 left-2 flex flex-row items-center gap-1 border border-cyan-200/30 bg-[#041018]/80 px-1.5 py-1 shadow-[0_0_24px_rgba(34,211,238,0.08)] backdrop-blur-md sm:top-3 sm:right-3 sm:left-3 sm:flex-col sm:items-stretch sm:gap-1.5 sm:px-2 sm:py-1.5 @min-[64rem]/hud:flex-row @min-[64rem]/hud:items-center lg:right-4 lg:left-16 ${
          barOpen ? "" : "max-sm:hidden"
        }`}
      >
        <div className="flex shrink-0 items-center gap-1 sm:min-w-0 sm:flex-wrap sm:gap-3">
          <div className="min-w-0 max-w-14 sm:max-w-none">
            <p className="hidden font-[family-name:var(--font-hud)] text-[0.62rem] tracking-[0.18em] text-cyan-200/80 uppercase sm:block">{m.productMark}</p>
            <p className="truncate font-[family-name:var(--font-hud)] text-sm leading-tight text-white">{m.productName}</p>
          </div>
          <div className="shrink-0">
            <p className="font-[family-name:var(--font-hud)] text-sm text-cyan-50 tabular-nums">{clock}</p>
            <p className="flex items-center gap-1.5 font-[family-name:var(--font-hud)] text-[0.62rem] tracking-[0.14em] text-cyan-100 uppercase">
              <span className={`size-1.5 rounded-full ${live ? "hud-pulse bg-[#3DDC97]" : "bg-[#FFC857]"}`} />
              {live ? m.live : props.trafficLoading ? m.sync : m.fault}
              {props.mapLive ? "" : ` · ${m.mapOff}`}
            </p>
          </div>
          <div className="hidden shrink-0 border border-white/15 sm:inline-flex" role="group" aria-label={m.language}>
            {LOCALES.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={locale === item}
                onClick={() => setLocale(item)}
                className={`px-1.5 py-1 font-[family-name:var(--font-hud)] text-[0.65rem] ${
                  locale === item ? "bg-white/10 text-white" : "text-cyan-100/70"
                }`}
              >
                {LOCALE_MARK[item]}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-expanded={open && tab === "notes"}
            onClick={() => show("notes", undefined)}
            className="hidden shrink-0 border border-cyan-200/50 bg-cyan-300/10 px-2 py-1 font-[family-name:var(--font-hud)] text-[0.65rem] tracking-[0.12em] text-cyan-50 sm:inline-flex"
          >
            {m.changelog}
          </button>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {origin ? (
            <OriginMenu
              pinnedId={pinned?.id ?? null}
              nearest={nearest}
              island={islandPoints}
              kowloon={kowloonPoints}
              onChoose={(id) => {
                setPinnedOrigin(id)
                const point = id ? approachPoints.find((item) => item.id === id) : nearest
                if (point) props.onFocus({ id: `harbour-origin-${point.id}`, coordinates: point.coordinates })
              }}
            />
          ) : null}
          <div className="bar-scroll flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto sm:gap-1.5">
          {origin ? (["CH", "EH", "WH"] as const).map((code) => {
            const crossing = crossings.find((item) => item.code === code)
            if (!crossing) {
              return (
                <Metric
                  key={code}
                  label={m[BAR_KEY[code]]}
                  value={m.harbourMissing}
                  tone={TONE.none}
                  hint={m.harbourMissingHint}
                  onClick={() => {
                    if (origin) props.onFocus({ id: `harbour-origin-${origin.id}`, coordinates: origin.coordinates })
                  }}
                />
              )
            }
            const road = displayText(m.locale, crossing.fromTc, crossing.from)
            const compare = crossing.slower > 0 ? m.slowerBy(crossing.slower) : m.fastestHere
            return (
              <Metric
                key={crossing.code}
                label={m[BAR_KEY[crossing.code]]}
                value={m.minutes(crossing.minutes)}
                tone={TONE[crossing.colour]}
                hint={`${m.approachHint(road)} ${compare}`}
                onClick={() => props.onFocus({ id: `crossing-${crossing.code}`, coordinates: crossing.coordinates })}
              />
            )
          }) : null}
          {incidentCount > 0 ? (
            <Metric
              label={m.incident}
              value={m.incidentsOpen(incidentCount)}
              tone={TONE.red}
              hint={m.incidentHint}
              onClick={() => show("roads", firstIncident)}
            />
          ) : null}
          <Metric
            label={m.boundary}
            value={halls.label}
            tone={TONE[halls.tone]}
            hint={m.boundaryHint}
            onClick={() => show("boundary", worstHall)}
          />
          {weather ? (
            <Metric
              label={m.weather}
              value={/^\d+°C/.test(weather.label) ? (weather.label.split(" · ")[0] ?? weather.label) : weather.label}
              tone={TONE[weather.tone]}
              hint={weather.label}
              onClick={() => show("weather", undefined)}
            />
          ) : null}
          <div className="inline-flex shrink-0 border border-white/15 sm:hidden" role="group" aria-label={m.language}>
            {LOCALES.map((item) => (
              <button
                key={`bar-${item}`}
                type="button"
                aria-pressed={locale === item}
                onClick={() => setLocale(item)}
                className={`px-1.5 py-1 font-[family-name:var(--font-hud)] text-[0.65rem] ${
                  locale === item ? "bg-white/10 text-white" : "text-cyan-100/70"
                }`}
              >
                {LOCALE_MARK[item]}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-expanded={open && tab === "notes"}
            onClick={() => show("notes", undefined)}
            className="shrink-0 border border-cyan-200/50 bg-cyan-300/10 px-2 py-1 font-[family-name:var(--font-hud)] text-[0.65rem] tracking-[0.12em] text-cyan-50 sm:hidden"
          >
            {m.changelog}
          </button>
          </div>
          <button
            type="button"
            onClick={() => show("roads", worstRoad)}
            className="block shrink-0 border border-white/10 bg-black/30 px-0.5 py-1 text-left sm:px-2"
            title={bandTitle(summary, m)}
          >
            <p className="font-[family-name:var(--font-hud)] text-[0.58rem] tracking-[0.14em] text-cyan-100/80 uppercase">{m.network}</p>
            <div className="flex items-center gap-2">
              <p className="font-[family-name:var(--font-hud)] text-sm leading-none text-white tabular-nums sm:text-base">
                {props.trafficLoading ? "…" : formatSpeed(summary?.meanSpeedKmh ?? null)}
              </p>
              {summary && totalBands > 0 ? (
                <div className="mt-1 hidden h-1.5 w-14 overflow-hidden bg-white/10 @min-[32rem]/bar:flex" aria-label={bandTitle(summary, m)}>
                  <span className="bg-[#3DDC97]" style={{ width: `${(summary.free / totalBands) * 100}%` }} />
                  <span className="bg-[#FFC857]" style={{ width: `${(summary.slow / totalBands) * 100}%` }} />
                  <span className="bg-[#FF5D73]" style={{ width: `${(summary.congested / totalBands) * 100}%` }} />
                </div>
              ) : null}
            </div>
          </button>
          <button
            type="button"
            aria-expanded={barOpen}
            onClick={() => setBarOpen(false)}
            className="shrink-0 border border-white/15 px-1.5 py-1 font-[family-name:var(--font-hud)] text-[0.65rem] text-cyan-50 sm:hidden"
          >
            {m.hide}
          </button>
        </div>
      </header>
      <section
        id="harbour-intel"
        data-map-chrome="panel"
        className={
          open
            ? "pointer-events-auto absolute right-3 bottom-[var(--intel-bottom,6rem)] z-[6] w-[min(22rem,calc(100%-1.5rem))] border border-cyan-200/30 bg-[#041018]/88 shadow-[0_0_24px_rgba(34,211,238,0.08)] backdrop-blur-md sm:bottom-36 lg:right-4 lg:bottom-14"
            : "pointer-events-auto absolute inset-x-0 bottom-[var(--marquee-bottom,3.5rem)] z-[6] border-t border-cyan-200/30 bg-[#041018]/88 shadow-[0_0_24px_rgba(34,211,238,0.08)] backdrop-blur-md sm:bottom-14"
        }
      >
        <div className="flex items-center gap-1 px-1.5 py-1">
          {open ? (
            <>
              <div role="tablist" aria-label={m.intel} className="flex min-w-0 flex-1 flex-wrap gap-0.5">
                {INTEL_TABS.map((id, index) => {
                  const selected = tab === id
                  const urgent = board[id].some((row) => row.urgent)
                  return (
                    <button
                      key={id}
                      id={`intel-tab-${id}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls="harbour-intel-list"
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setTab(id)}
                      onKeyDown={(event) => onTabKey(event, index, setTab)}
                      className={`inline-flex shrink-0 items-center gap-1 px-1.5 py-1 font-[family-name:var(--font-hud)] text-[0.62rem] tracking-[0.08em] uppercase ${
                        selected ? "border-b-2 border-cyan-200 text-white" : "border-b-2 border-transparent text-cyan-100/70"
                      }`}
                    >
                      {tabLabel(id, m)}
                      {urgent ? <span className="size-1 rounded-full bg-[#FF5D73]" /> : null}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                aria-expanded={open}
                aria-controls="harbour-intel-list"
                onClick={() => changeOpen(false)}
                className="ml-auto shrink-0 border border-white/15 px-2 py-1 font-[family-name:var(--font-hud)] text-[0.65rem] tracking-[0.12em] text-cyan-50 uppercase"
              >
                {m.hide}
              </button>
            </>
          ) : (
            <>
              <span className="shrink-0 font-[family-name:var(--font-hud)] text-[0.62rem] tracking-[0.14em] text-cyan-100/70 uppercase">
                {tabLabel("ranked", m)}
              </span>
              <IntelMarquee items={ranked} empty={emptyCopy("ranked", m)} seconds={marqueeSeconds} onFocus={props.onFocus} />
              {urgentCount > 0 ? (
                <span className="shrink-0 font-[family-name:var(--font-hud)] text-[0.65rem] tracking-[0.12em] text-[#FF5D73] uppercase">{urgentCount}</span>
              ) : null}
              <button
                type="button"
                aria-expanded={open}
                aria-controls="harbour-intel-list"
                onClick={() => changeOpen(true)}
                className="ml-1 shrink-0 border border-white/15 px-2 py-1 font-[family-name:var(--font-hud)] text-[0.65rem] tracking-[0.12em] text-cyan-50 uppercase"
              >
                {m.intel}
              </button>
            </>
          )}
        </div>
        {open ? (
          <div
            id="harbour-intel-list"
            role="tabpanel"
            aria-labelledby={`intel-tab-${tab}`}
            className="intel-scroll max-h-[min(26rem,46dvh,var(--intel-list-max,100dvh))] overflow-y-auto border-t border-white/10 px-2 py-2"
          >
            {tab === "notes" ? (
              <ChangelogList />
            ) : intel.length === 0 ? (
              <p className="px-1 py-2 text-sm text-zinc-300">{emptyCopy(tab, m)}</p>
            ) : (
              <ol className="flex flex-col gap-1">
                {intel.map((item) => (
                  <li key={item.id}>
                    <IntelRow item={item} onFocus={props.onFocus} />
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : null}
      </section>
    </div>
  )
}

function OriginMenu(props: {
  pinnedId: string | null
  nearest: ApproachPoint | null
  island: ApproachPoint[]
  kowloon: ApproachPoint[]
  onChoose: (id: string | null) => void
}) {
  const { locale, messages: m } = useI18n()
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const place = () => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(352, window.innerWidth - 16)
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
      const top = Math.round(rect.bottom + 4)
      setBox({ top, left: Math.round(left), width: Math.round(width), maxHeight: Math.max(160, window.innerHeight - top - 8) })
    }
    place()
    window.addEventListener("resize", place)
    return () => window.removeEventListener("resize", place)
  }, [open])
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])
  const chosen = props.pinnedId
    ? [...props.island, ...props.kowloon].find((point) => point.id === props.pinnedId) ?? props.nearest
    : props.nearest
  const road = chosen ? displayText(locale, chosen.nameTc, chosen.name) : ""
  const choose = (id: string | null) => {
    props.onChoose(id)
    setOpen(false)
  }
  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={m.harbourFrom}
        onClick={() => setOpen((current) => !current)}
        className="block max-w-28 border border-white/10 bg-black/30 px-1 py-1 text-left sm:max-w-56 sm:px-2"
      >
        <span className="block font-[family-name:var(--font-hud)] text-[0.58rem] tracking-[0.14em] text-cyan-100/80 uppercase">{m.harbourFrom}</span>
        <span className="block truncate font-[family-name:var(--font-hud)] text-sm leading-none text-white sm:text-base">
          {props.pinnedId ? road : m.followMap(road)}
        </span>
      </button>
      {open && box
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-label={m.harbourFrom}
              style={{ top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }}
              className="fixed z-50 overflow-y-auto border border-cyan-200/30 bg-[#041018] p-1 text-sm text-white shadow-[0_0_24px_rgba(34,211,238,0.12)]"
            >
              <OriginChoice selected={props.pinnedId == null} onChoose={() => choose(null)}>
                {m.followMap(props.nearest ? displayText(locale, props.nearest.nameTc, props.nearest.name) : "")}
              </OriginChoice>
              <OriginList label={m.fromIsland} points={props.island} pinnedId={props.pinnedId} onChoose={choose} />
              <OriginList label={m.fromKowloon} points={props.kowloon} pinnedId={props.pinnedId} onChoose={choose} />
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

function OriginList(props: { label: string; points: ApproachPoint[]; pinnedId: string | null; onChoose: (id: string) => void }) {
  const { locale } = useI18n()
  if (props.points.length === 0) return null
  return (
    <div className="mt-1">
      <p className="px-2 py-1 font-[family-name:var(--font-hud)] text-[0.58rem] tracking-[0.14em] text-cyan-100/70 uppercase">{props.label}</p>
      {props.points.map((point) => (
        <OriginChoice key={point.id} selected={props.pinnedId === point.id} onChoose={() => props.onChoose(point.id)}>
          {displayText(locale, point.nameTc, point.name)}
        </OriginChoice>
      ))}
    </div>
  )
}

function OriginChoice(props: { selected: boolean; onChoose: () => void; children: string }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={props.selected}
      onClick={props.onChoose}
      className={`block w-full px-2 py-1.5 text-left whitespace-nowrap text-white hover:bg-white/10 ${props.selected ? "bg-white/10" : ""}`}
    >
      {props.children}
    </button>
  )
}

function Metric(props: { label: string; value: string; tone: string; hint?: string; className?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      title={props.hint}
      className={`block shrink-0 border border-white/10 bg-black/30 px-0.5 py-1 text-left sm:px-2 ${props.className ?? ""}`}
    >
      <p className="font-[family-name:var(--font-hud)] text-[0.58rem] tracking-[0.14em] text-cyan-100/80 uppercase">{props.label}</p>
      <p className="font-[family-name:var(--font-hud)] text-sm leading-none whitespace-nowrap tabular-nums sm:text-base" style={{ color: props.tone }}>
        {props.value}
      </p>
    </button>
  )
}

function ChangelogList() {
  const { locale, messages: m } = useI18n()
  const kind = {
    added: m.changelogAdded,
    fixed: m.changelogFixed,
    improved: m.changelogImproved,
  }
  return (
    <ol className="flex flex-col gap-2">
      {CHANGELOG.map((entry) => (
        <li key={entry.id} className="border border-white/10 bg-black/20 px-2 py-1.5">
          <p className="flex flex-wrap items-center gap-2 font-[family-name:var(--font-hud)] text-[0.62rem] tracking-[0.08em] text-cyan-100/80 uppercase">
            <time dateTime={entry.date}>{changelogDay(entry.date, locale)}</time>
            <span className="text-cyan-50">{kind[entry.kind]}</span>
          </p>
          <p className="mt-1 text-sm leading-5 text-zinc-100">{changelogText(entry, locale)}</p>
        </li>
      ))}
    </ol>
  )
}

function changelogDay(date: string, locale: ReturnType<typeof useI18n>["locale"]): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(Date.parse(`${date}T00:00:00+08:00`))
}

function tabLabel(id: IntelTab, m: Messages): string {
  switch (id) {
    case "ranked":
      return m.ranked
    case "roads":
      return m.roads
    case "boundary":
      return m.boundary
    case "weather":
      return m.weather
    case "systems":
      return m.systems
    case "notes":
      return m.changelog
    default: {
      const exhaustive: never = id
      return exhaustive
    }
  }
}

function bandTitle(summary: { free: number; slow: number; congested: number } | null, m: ReturnType<typeof useI18n>["messages"]): string {
  if (!summary) return m.network
  return `${m.good} ${summary.free}, ${m.average} ${summary.slow}, ${m.bad} ${summary.congested}`
}

function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number, setTab: (tab: IntelTab) => void) {
  const last = INTEL_TABS.length - 1
  let next = index
  if (event.key === "ArrowRight") next = index === last ? 0 : index + 1
  else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1
  else if (event.key === "Home") next = 0
  else if (event.key === "End") next = last
  else return
  event.preventDefault()
  const id = INTEL_TABS[next]
  if (!id) return
  setTab(id)
  requestAnimationFrame(() => document.getElementById(`intel-tab-${id}`)?.focus())
}

function IntelMarquee(props: { items: IntelItem[]; empty: string; seconds: number; onFocus: OpsHudProps["onFocus"] }) {
  const { messages } = useI18n()
  const items = props.items.length > 0 ? props.items : [quietItem(props.empty, messages.clear)]
  return (
    <div className="min-w-0 flex-1 overflow-hidden" aria-label={messages.intel}>
      <div className="intel-marquee flex w-max" style={{ animationDuration: `${props.seconds}s` }}>
        {[0, 1].map((copy) => (
          <div key={copy} className="intel-marquee-copy flex shrink-0 items-center" aria-hidden={copy === 1}>
            {items.map((item) => (
              <button
                key={`${copy}-${item.id}`}
                type="button"
                tabIndex={copy === 1 ? -1 : 0}
                disabled={item.coordinates == null}
                onClick={() => {
                  if (!item.coordinates) return
                  props.onFocus({ id: item.id, coordinates: item.coordinates })
                }}
                className="mx-5 whitespace-nowrap font-[family-name:var(--font-hud)] text-[0.72rem] text-cyan-50 disabled:cursor-default"
              >
                <span style={{ color: TONE[item.tone] }}>{item.label}</span>
                <span className="text-white"> · {item.title}</span>
                {item.detail ? <span className="text-zinc-300"> — {item.detail}</span> : null}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function IntelRow(props: { item: IntelItem; onFocus: OpsHudProps["onFocus"] }) {
  const { item } = props
  return (
    <button
      type="button"
      disabled={item.coordinates == null}
      onClick={() => {
        if (!item.coordinates) return
        props.onFocus({ id: item.id, coordinates: item.coordinates })
      }}
      className="flex w-full items-start gap-2 px-1 py-1 text-left enabled:hover:bg-white/5 disabled:cursor-default"
    >
      <span className="mt-1 size-1.5 shrink-0 rounded-full" style={{ background: TONE[item.tone] }} />
      <span className="min-w-0">
        <span className="block font-[family-name:var(--font-hud)] text-[0.62rem] tracking-[0.14em] text-cyan-100/80 uppercase">{item.label}</span>
        <span className="block text-sm text-white">{item.title}</span>
        {item.detail ? <span className="block text-xs text-zinc-300">{item.detail}</span> : null}
      </span>
    </button>
  )
}

function quietItem(title: string, label: string): IntelItem {
  return {
    id: "intel-clear",
    kind: "slow",
    score: 0,
    urgent: false,
    label,
    title,
    detail: "",
    tone: "green",
    coordinates: null,
  }
}

const CLOCK_PLACEHOLDER = "--:--:--"

function emptyCopy(tab: IntelTab, m: ReturnType<typeof useI18n>["messages"]): string {
  switch (tab) {
    case "ranked":
      return m.emptyRanked
    case "roads":
      return m.emptyRoads
    case "boundary":
      return m.emptyBoundary
    case "weather":
      return m.emptyWeather
    case "systems":
      return m.emptySystems
    case "notes":
      return m.changelog
    default: {
      const exhaustive: never = tab
      return exhaustive
    }
  }
}

function useHongKongClock(locale: ReturnType<typeof useI18n>["locale"]): string {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [])
  if (!now) return CLOCK_PLACEHOLDER
  return formatClock(now, locale)
}
