import { withBase } from "@/lib/base-path"
import { bandWord, formatStamp, type Messages } from "@/lib/i18n"
import type { TrainSpot } from "@/lib/train-estimate"
import { lineRecord, linesThrough, projectNetworkTrain, stationRecord, type RailMode } from "@/lib/rail-network"
import { isJamCamUrl } from "@/lib/jamcams"
import { isSpeedBand } from "@/lib/speed"
import { clearBoardFault, markBoardFault } from "@/lib/board-status"
import { routesWithoutArrival } from "@/lib/stop-routes"
import type { BusCall, LineStatus, LiftOutage, RailCalling, RailResponse, SpeedBand, VehicleTrip } from "@/lib/types"
import { tripCollection } from "@/lib/vehicle-trip"

export type TransitContext = { lines: LineStatus[]; lifts: LiftOutage[] }

export function corridorPopup(properties: GeoJSON.GeoJsonProperties, m: Messages): HTMLElement {
  const card = openCard(textProp(properties, "name") || m.roads)
  const band = textProp(properties, "band")
  const status = textProp(properties, "status")
  if (isSpeedBand(band) && band !== "unknown") {
    card.body.append(fact(m.statusLabel, properties?.closed === true ? m.closed : bandWord(band, m), bandTone(band)))
  } else if (status) {
    card.body.append(fact(m.statusLabel, status))
  }
  const detail = textProp(properties, "detail")
  if (detail) card.body.append(paragraph("city-card-copy", detail))
  card.root.append(paragraph("city-card-aside", m.roadsKey))
  return card.root
}

export function cameraPopup(properties: GeoJSON.GeoJsonProperties, m: Messages): HTMLElement {
  const name = textProp(properties, "name")
  const card = openCard(name || m.cameras)
  const view = textProp(properties, "view")
  if (view) card.body.append(fact(m.facingLabel, view))
  const image = textProp(properties, "image")
  if (!isJamCamUrl(image)) return card.root
  const figure = document.createElement("figure")
  figure.className = "city-card-figure"
  const still = document.createElement("img")
  still.alt = name
  still.addEventListener("error", () => {
    figure.remove()
    card.root.append(paragraph("city-card-note", m.snapshotFailed))
  })
  // TfL replaces the still every few minutes under the same name.
  still.src = `${image}?t=${Math.floor(Date.now() / 120_000)}`
  figure.append(still)
  card.root.append(figure)
  const video = textProp(properties, "video")
  if (isJamCamUrl(video)) {
    const play = document.createElement("button")
    play.type = "button"
    play.className = "city-card-action"
    play.textContent = m.playClip
    play.addEventListener("click", () => {
      const clip = document.createElement("video")
      clip.src = video
      clip.autoplay = true
      clip.muted = true
      clip.playsInline = true
      clip.controls = true
      clip.poster = still.src
      clip.className = "city-card-video"
      figure.replaceChildren(clip)
      play.remove()
    })
    card.root.append(play)
  }
  return card.root
}

export function disruptionPopup(properties: GeoJSON.GeoJsonProperties, m: Messages): HTMLElement {
  const card = openCard(textProp(properties, "title") || m.incident)
  const location = textProp(properties, "location")
  if (location) card.head.append(paragraph("city-card-detail", location))
  const category = [textProp(properties, "category"), textProp(properties, "subCategory")].filter(Boolean).join(" · ")
  if (category) card.body.append(fact(m.categoryLabel, category))
  const severity = textProp(properties, "severity")
  if (severity) card.body.append(fact(m.severityLabel, properties?.closure === true ? `${severity} · ${m.closed}` : severity, severityTone(numberProp(properties, "rank") ?? 0, properties?.closure === true)))
  const when = timeRange(textProp(properties, "start"), textProp(properties, "end"))
  if (when) card.body.append(fact(m.whenLabel, when))
  const update = textProp(properties, "update")
  const comments = textProp(properties, "comments")
  if (comments) card.body.append(paragraph("city-card-copy", comments))
  if (update && update !== comments) {
    card.body.append(fact(m.latestLabel, formatStamp(textProp(properties, "updatedAt"))))
    card.body.append(paragraph("city-card-copy", update))
  }
  return card.root
}

export function chargePopup(properties: GeoJSON.GeoJsonProperties, m: Messages): HTMLElement {
  const card = openCard(textProp(properties, "name") || m.charges)
  const detail = textProp(properties, "detail")
  if (detail) card.body.append(paragraph("city-card-copy", detail))
  return card.root
}

export function stationPopup(
  properties: GeoJSON.GeoJsonProperties,
  snapshot: RailResponse | null,
  context: TransitContext,
  mode: RailMode,
  m: Messages,
): HTMLElement {
  const code = textProp(properties, "code")
  const record = stationRecord(code)
  const card = openCard(record?.name ?? (textProp(properties, "name") || m.rail))
  const lines = linesThrough(code, mode)
  const names = lines.map((line) => lineRecord(line)?.name ?? line)
  if (names.length > 0) card.head.append(paragraph("city-card-detail", names.join(", ")))
  for (const line of lines) {
    const status = context.lines.find((item) => item.id === line)
    if (status && status.tone !== "green") card.body.append(fact(lineRecord(line)?.name ?? line, status.status, toneColour(status.tone)))
  }
  const lift = context.lifts.find((item) => item.station === record?.name)
  if (lift) card.body.append(fact(m.liftOutage, ""), paragraph("city-card-copy", lift.message))
  if (code.startsWith("940GZZLU")) mountCrowding(card.body, code, m)
  if (!snapshot?.ok) {
    card.body.append(paragraph("city-card-copy", failedCopy(mode, m)))
    return card.root
  }
  const board = document.createElement("div")
  board.className = "city-card-board"
  let anyTrain = false
  for (const line of lines) {
    const listing = snapshot.boards.find((item) => item.line === line && item.station === code)
    if (lines.length > 1) board.append(paragraph("city-card-section", lineRecord(line)?.name ?? line))
    const callings = nextByDest(listing?.trains ?? [])
    if (callings.length === 0) {
      board.append(paragraph("city-card-copy", mode === "river" ? m.riverNone : m.railNoTrain))
      continue
    }
    anyTrain = true
    for (const calling of callings) {
      const when = calling.ttnt < 1 ? m.railArriving : m.minutes(Math.floor(calling.ttnt))
      const plat = /^\w{1,3}$/.test(calling.plat) ? `${m.railPlatform} ${calling.plat}` : calling.plat
      board.append(serviceRow(m.towards(calling.destName || calling.dest), when, plat))
    }
  }
  if (!anyTrain && lines.length === 0) card.body.append(paragraph("city-card-copy", m.railNoTrain))
  else card.body.append(board)
  return card.root
}

const crowdingSeen = new Map<string, { at: number; percent: number | null }>()

function mountCrowding(body: HTMLElement, code: string, m: Messages) {
  const row = fact(m.crowdingLabel, "…")
  const value = row.querySelector(".city-card-fact-value")
  const hit = crowdingSeen.get(code)
  const paint = (percent: number | null) => {
    if (percent == null) row.remove()
    else if (value) value.textContent = m.crowding(percent)
  }
  body.append(row)
  if (hit && Date.now() - hit.at < 120_000) {
    paint(hit.percent)
    return
  }
  void fetch(withBase(`/api/crowding?id=${encodeURIComponent(code)}`), { cache: "no-store" })
    .then((response) => response.json())
    .then((payload: unknown) => {
      const percent =
        typeof payload === "object" && payload !== null && "ok" in payload && payload.ok === true && "percent" in payload && typeof payload.percent === "number"
          ? payload.percent
          : null
      crowdingSeen.set(code, { at: Date.now(), percent })
      paint(percent)
    })
    .catch(() => row.remove())
}

export function trainPopup(properties: GeoJSON.GeoJsonProperties, snapshot: RailResponse | null, mode: RailMode, m: Messages): HTMLElement {
  const listed = snapshot?.trains.find((item) => item.id === textProp(properties, "id")) ?? null
  const lineCode = textProp(properties, "line") || listed?.line || ""
  const destCode = textProp(properties, "dest") || listed?.dest || ""
  const destName = stationRecord(destCode)?.name ?? destCode
  const card = openCard(destName ? m.towards(destName) : failedCopy(mode, m))
  const line = lineRecord(lineCode)
  if (line) card.head.append(paragraph("city-card-detail", line.name))
  const from = textProp(properties, "from")
  const to = textProp(properties, "to")
  const minutesOnDot = numberProp(properties, "minutes")
  const shown: TrainSpot | null =
    from && to && minutesOnDot != null
      ? { lng: 0, lat: 0, from, to, clamp: "none", minutes: minutesOnDot }
      : listed
        ? projectNetworkTrain(listed, Date.now())
        : null
  const riding = shown != null && shown.from !== shown.to
  const nextCode = riding && shown ? shown.to : from || listed?.anchor || ""
  const nextName = stationRecord(nextCode)?.name ?? ""
  if (nextName) card.body.append(fact(m.railNext, nextName))
  const minutes = shown ? Math.max(0, Math.round(shown.minutes)) : Math.round(listed?.ttnt ?? 0)
  card.body.append(fact(m.whenLabel, minutes <= 0 ? m.railArriving : m.minutes(minutes)))
  const plat = textProp(properties, "plat") || listed?.plat || ""
  if (plat) card.body.append(fact(m.railPlatform, plat))
  if (shown) card.body.append(fact(m.railPosition, positionSentence(shown, m)))
  card.body.append(paragraph("city-card-aside", m.railMethod))
  return card.root
}

const BOARD_MS = 30_000
const seenBoards = new Map<string, { at: number; calls: BusCall[]; routes: string[] }>()

export function busStopPopup(properties: GeoJSON.GeoJsonProperties, m: Messages): HTMLElement {
  const name = textProp(properties, "name") || m.bus
  const indicator = textProp(properties, "indicator")
  const card = openCard(indicator ? `${name} (${indicator})` : name)
  const id = textProp(properties, "id")
  const routes = listProp(properties, "routes")
  if (routes.length > 0) card.head.append(paragraph("city-card-detail", routes.join(" · ")))
  if (!id) {
    paintBoard(card.body, [], routes, m)
    return card.root
  }
  const hit = seenBoards.get(id)
  if (hit && Date.now() - hit.at < BOARD_MS) {
    paintBoard(card.body, hit.calls, hit.routes, m)
    return card.root
  }
  card.body.replaceChildren(paragraph("city-card-copy", m.boardLoading))
  void fetch(withBase(`/api/board?id=${encodeURIComponent(id)}`), { cache: "no-store" })
    .then((response) => response.json())
    .then((payload: unknown) => {
      if (!card.body.isConnected) return
      const calls = readBusCalls(payload)
      if (!calls) {
        markBoardFault({ id, name })
        paintBoard(card.body, [], routes, m, m.busFailed)
        return
      }
      clearBoardFault(id)
      seenBoards.set(id, { at: Date.now(), calls, routes })
      paintBoard(card.body, calls, routes, m)
    })
    .catch(() => {
      if (!card.body.isConnected) return
      markBoardFault({ id, name })
      paintBoard(card.body, [], routes, m, m.busFailed)
    })
  return card.root
}

function paintBoard(body: HTMLElement, calls: BusCall[], routes: string[], m: Messages, empty = m.busNone) {
  body.replaceChildren()
  const quiet = routesWithoutArrival(routes, calls.map((call) => call.route))
  if (calls.length === 0) {
    body.append(paragraph("city-card-copy", empty))
    return
  }
  const board = document.createElement("div")
  board.className = "city-card-board"
  for (const call of calls.slice(0, 12)) {
    const row = document.createElement("div")
    row.className = "city-card-call"
    row.append(
      text("span", "city-card-call-route", call.route),
      text("span", "city-card-call-dest", call.dest ? m.towards(call.dest) : ""),
      text("span", "city-card-call-when", call.minutes == null || call.minutes <= 0 ? m.railArriving : m.minutes(call.minutes)),
    )
    board.append(row)
  }
  for (const route of quiet) {
    const row = document.createElement("div")
    row.className = "city-card-call"
    row.append(text("span", "city-card-call-route", route))
    board.append(row)
  }
  body.append(board)
}

function readBusCalls(payload: unknown): BusCall[] | null {
  if (typeof payload !== "object" || payload === null || !("ok" in payload) || payload.ok !== true) return null
  if (!("stop" in payload) || typeof payload.stop !== "object" || payload.stop === null) return null
  const calls = (payload.stop as { calls?: unknown }).calls
  if (!Array.isArray(calls)) return null
  return calls.flatMap((item) => {
    if (typeof item !== "object" || item === null) return []
    const row = item as Record<string, unknown>
    if (typeof row.route !== "string" || !row.route) return []
    return [{
      route: row.route,
      dest: typeof row.dest === "string" ? row.dest : "",
      eta: typeof row.eta === "string" ? row.eta : "",
      minutes: typeof row.minutes === "number" ? row.minutes : null,
      vehicle: typeof row.vehicle === "string" ? row.vehicle : "",
    }]
  })
}

const NEXT_STOPS = 6

export function busVehiclePopup(properties: GeoJSON.GeoJsonProperties, m: Messages, showTrip?: (trip: GeoJSON.FeatureCollection) => void): HTMLElement {
  const route = textProp(properties, "route")
  const dest = textProp(properties, "dest")
  const card = openCard([route, dest ? m.towards(dest) : ""].filter(Boolean).join(" ") || m.bus)
  const operator = textProp(properties, "operator")
  if (operator) card.body.append(fact(m.busOperatorLabel, operator === "TFLO" ? m.londonBuses : operator))
  const origin = textProp(properties, "origin")
  const departed = formatStamp(textProp(properties, "departed"))
  if (origin) card.body.append(fact(m.busStarted, departed ? m.busStartedAt(origin, departed.split(" ").pop() ?? departed) : origin))
  const at = numberProp(properties, "at")
  if (at != null) card.body.append(fact(m.busReportedLabel, m.busReported(Math.max(0, Math.round((Date.now() - at) / 1000)))))
  // TfL predicts stops by the same registration the position feed carries.
  const reg = textProp(properties, "id").split(":")[1] ?? ""
  if (operator === "TFLO" && reg) {
    const stops = document.createElement("div")
    stops.className = "city-card-board"
    stops.append(paragraph("city-card-copy", m.boardLoading))
    card.body.append(stops)
    void fetch(withBase(`/api/vehicle?reg=${encodeURIComponent(reg)}`), { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: unknown) => {
        if (!stops.isConnected) return
        const trip = readTrip(payload)
        if (!trip || trip.stops.length === 0) {
          stops.replaceChildren(paragraph("city-card-copy", m.busNoStops))
          return
        }
        stops.replaceChildren(paragraph("city-card-section", m.busNextStops))
        for (const stop of trip.stops.slice(0, NEXT_STOPS)) {
          stops.append(serviceRow(stop.indicator ? `${stop.name} (${stop.indicator})` : stop.name, stop.minutes <= 0 ? m.railArriving : m.minutes(stop.minutes)))
        }
        showTrip?.(tripCollection(trip, NEXT_STOPS))
      })
      .catch(() => {
        if (stops.isConnected) stops.replaceChildren(paragraph("city-card-copy", m.busNoStops))
      })
  }
  card.body.append(paragraph("city-card-aside", m.busMethod))
  return card.root
}

function readTrip(payload: unknown): VehicleTrip | null {
  if (typeof payload !== "object" || payload === null || !("ok" in payload) || payload.ok !== true || !("trip" in payload)) return null
  const trip = payload.trip as VehicleTrip | null
  return trip && Array.isArray(trip.stops) && Array.isArray(trip.route) ? trip : null
}

export function cyclePopup(properties: GeoJSON.GeoJsonProperties, m: Messages): HTMLElement {
  const card = openCard(textProp(properties, "name") || m.cycles)
  card.body.append(
    fact(m.bikes, String(numberProp(properties, "bikes") ?? 0)),
    fact(m.ebikes, String(numberProp(properties, "ebikes") ?? 0)),
    fact(m.emptyDocks, String(numberProp(properties, "empty") ?? 0)),
  )
  return card.root
}

export function airPopup(properties: GeoJSON.GeoJsonProperties, m: Messages): HTMLElement {
  const card = openCard(textProp(properties, "name") || m.air)
  const index = numberProp(properties, "index")
  const band = textProp(properties, "band")
  card.body.append(fact(m.statusLabel, index == null ? m.airNoData : m.airIndex(band, index), index == null ? undefined : airTone(index)))
  const species = textProp(properties, "species")
  if (species && index != null) card.body.append(fact(m.airPollutant, species))
  return card.root
}

export function planningPopup(properties: GeoJSON.GeoJsonProperties, m: Messages): HTMLElement {
  const stage = textProp(properties, "stage")
  const card = openCard(textProp(properties, "site") || m.planning)
  card.head.append(paragraph("city-card-detail", stage === "building" ? m.planningBuilding : stage === "pending" ? m.planningPending : m.planningDecided))
  const authority = textProp(properties, "authority")
  if (authority) card.body.append(fact(m.authorityLabel, authority))
  const status = textProp(properties, "status")
  if (status) card.body.append(fact(m.statusLabel, status))
  const valid = textProp(properties, "validDate")
  if (valid) card.body.append(fact(m.validLabel, valid))
  const commenced = textProp(properties, "commencedDate")
  if (commenced) card.body.append(fact(m.commencedLabel, commenced))
  const description = textProp(properties, "description")
  if (description) card.body.append(paragraph("city-card-copy", clip(description, 420)))
  return card.root
}

function failedCopy(mode: RailMode, m: Messages): string {
  return mode === "rail" ? m.railFailed : mode === "light" ? m.lightFailed : m.riverFailed
}

function nextByDest(trains: RailCalling[]): RailCalling[] {
  const best = new Map<string, RailCalling>()
  for (const train of trains) {
    const key = train.dest || train.destName
    const current = best.get(key)
    if (!current || train.ttnt < current.ttnt) best.set(key, train)
  }
  return [...best.values()].sort((a, b) => a.ttnt - b.ttnt).slice(0, 6)
}

function positionSentence(spot: TrainSpot, m: Messages): string {
  const fromName = stationRecord(spot.from)?.name ?? spot.from
  const toName = stationRecord(spot.to)?.name ?? spot.to
  if (spot.clamp === "junction") return m.railHeld(toName)
  if (spot.from === spot.to || spot.clamp === "origin") return m.railHere(toName)
  return m.railBetween(fromName, toName)
}

function openCard(title: string): { root: HTMLElement; head: HTMLElement; body: HTMLElement } {
  const root = document.createElement("article")
  root.className = "city-card"
  const head = document.createElement("header")
  head.className = "city-card-head"
  head.append(text("h2", "city-card-title", title))
  const body = document.createElement("div")
  body.className = "city-card-body"
  root.append(head, body)
  return { root, head, body }
}

function serviceRow(primary: string, when: string, kind = ""): HTMLElement {
  const row = document.createElement("div")
  row.className = "city-card-call city-card-call-plain"
  row.append(text("span", "city-card-call-dest", primary), text("span", "city-card-call-when", when))
  if (kind) row.append(text("span", "city-card-call-kind", kind))
  return row
}

function fact(label: string, value: string, tone?: string): HTMLElement {
  const row = document.createElement("div")
  row.className = "city-card-fact"
  row.append(text("span", "city-card-fact-label", label))
  const valueNode = text("span", "city-card-fact-value", value)
  if (tone) valueNode.style.color = tone
  row.append(valueNode)
  return row
}

function paragraph(className: string, value: string): HTMLElement {
  return text("p", className, value)
}

function text<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, value = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (value) node.textContent = value
  return node
}

// Card text is dark on a light card, so tones are the deep shades.
function toneColour(tone: "red" | "amber" | "green"): string {
  return tone === "red" ? "#b42318" : tone === "amber" ? "#8a5a00" : "#0b7a45"
}

function bandTone(band: SpeedBand): string {
  switch (band) {
    case "free":
      return "#0b7a45"
    case "slow":
      return "#8a5a00"
    case "congested":
      return "#b42318"
    case "unknown":
      return "#102033"
    default: {
      const exhaustive: never = band
      return exhaustive
    }
  }
}

function severityTone(rank: number, closure: boolean): string | undefined {
  if (closure || rank >= 3) return "#b42318"
  if (rank >= 2) return "#8a5a00"
  return undefined
}

function airTone(index: number): string {
  return index >= 10 ? "#7a0a6e" : index >= 7 ? "#b42318" : index >= 4 ? "#8a5a00" : "#0b7a45"
}

function timeRange(start: string, end: string): string {
  const from = formatStamp(start)
  const to = formatStamp(end)
  if (from && to) return `${from} – ${to}`
  return from || to
}

function clip(value: string, limit: number): string {
  if (value.length <= limit) return value
  return `${value.slice(0, limit - 1).trimEnd()}…`
}

function listProp(properties: GeoJSON.GeoJsonProperties, key: string): string[] {
  const raw = textProp(properties, key)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

function numberProp(properties: GeoJSON.GeoJsonProperties, key: string): number | null {
  const value = properties?.[key]
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return value
}

function textProp(properties: GeoJSON.GeoJsonProperties, key: string): string {
  const value = properties?.[key]
  return typeof value === "string" ? value : ""
}
